import { Router, Response } from "express";
import { z } from "zod";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, userInvitationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

const PROTECTED_FIELDS = ["role", "userId", "isTestData", "isSandbox", "id", "createdAt", "updatedAt"] as const;

function stripProtectedFields(body: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...body };
  for (const field of PROTECTED_FIELDS) {
    delete safe[field];
  }
  return safe;
}

const selfUpdateSchema = z.object({
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  jobTitle: z.string().nullable().optional(),
  commissionPercent: z.string().optional().nullable(),
  fixedSalary: z.string().optional().nullable(),
}).strict();

const onboardingSchema = z.object({
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  position: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  commissionPercent: z.string().optional().nullable(),
  fixedSalary: z.string().optional().nullable(),
}).strict();

const gestorUpdateSchema = z.object({
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  position: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  role: z.enum(["user", "gestor", "admin"]).optional(),
  commissionPercent: z.string().optional().nullable(),
  fixedSalary: z.string().optional().nullable(),
}).strict();

router.get("/", requireAuthWithRole, requireGestor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profiles = await db.select().from(profilesTable);
    res.json(profiles);
  } catch {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/me", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/me/onboarding", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }

    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));

    if (existing.length === 0) {
      let inviteRole: string = "user";
      let invitePosition: string | null = null;
      let inviteFixedSalary: string | null = null;
      let inviteCommissionPercent: string | null = null;

      try {
        const clerkUser = await clerkClient.users.getUser(req.userId);
        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        )?.emailAddress;

        if (primaryEmail) {
          const normalizedEmail = primaryEmail.toLowerCase().trim();
          const [invite] = await db
            .select()
            .from(userInvitationsTable)
            .where(and(
              eq(userInvitationsTable.email, normalizedEmail),
              eq(userInvitationsTable.status, "pending")
            ));

          if (invite) {
            inviteRole = invite.role ?? "user";
            invitePosition = invite.position ?? null;
            inviteFixedSalary = invite.fixedSalary ?? null;
            inviteCommissionPercent = invite.commissionPercent ?? null;

            await db
              .update(userInvitationsTable)
              .set({ status: "accepted", acceptedAt: new Date() })
              .where(eq(userInvitationsTable.id, invite.id));
          }
        }
      } catch {
        // Non-critical: Clerk lookup or invite lookup failure falls back to defaults
      }

      const safeData = stripProtectedFields(parsed.data as Record<string, unknown>);
      const [profile] = await db
        .insert(profilesTable)
        .values({
          userId: req.userId,
          role: inviteRole,
          position: invitePosition,
          fixedSalary: (safeData.fixedSalary as string | null | undefined) ?? inviteFixedSalary ?? null,
          commissionPercent: (safeData.commissionPercent as string | null | undefined) ?? inviteCommissionPercent ?? null,
          fullName: (safeData.fullName as string | undefined) ?? null,
          displayName: (safeData.displayName as string | undefined) ?? null,
          jobTitle: (safeData.jobTitle as string | null | undefined) ?? null,
        })
        .returning();
      res.json(profile);
      return;
    }

    const safeData = stripProtectedFields(parsed.data as Record<string, unknown>);
    const [profile] = await db
      .update(profilesTable)
      .set(safeData)
      .where(eq(profilesTable.userId, req.userId))
      .returning();
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to save onboarding profile" });
  }
});

router.patch("/me", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = selfUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const safeData = stripProtectedFields(parsed.data as Record<string, unknown>);
    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));

    if (existing.length === 0) {
      const [profile] = await db
        .insert(profilesTable)
        .values({ userId: req.userId, role: "user", ...safeData })
        .returning();
      res.json(profile);
      return;
    }

    const [profile] = await db
      .update(profilesTable)
      .set(safeData)
      .where(eq(profilesTable.userId, req.userId))
      .returning();
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = gestorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const safeBody = { ...parsed.data };
    if (safeBody.role === "admin" && req.userRole !== "admin") {
      res.status(403).json({ error: "Only admins can elevate accounts to admin role" });
      return;
    }
    const [profile] = await db
      .update(profilesTable)
      .set(safeBody)
      .where(eq(profilesTable.id, req.params["id"] as string))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
