import { Router, Response } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

const PROTECTED_FIELDS = ["role", "isTestData", "isSandbox"] as const;

function stripProtectedFields(body: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...body };
  for (const field of PROTECTED_FIELDS) {
    delete safe[field];
  }
  return safe;
}

router.get("/", requireAuthWithRole, requireGestor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profiles = await db.select().from(profilesTable);
    res.json(profiles);
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/me", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const safeBody = stripProtectedFields(req.body);
    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));

    if (existing.length === 0) {
      const [profile] = await db
        .insert(profilesTable)
        .values({ userId: req.userId, ...safeBody })
        .returning();
      res.json(profile);
      return;
    }

    const [profile] = await db
      .update(profilesTable)
      .set(safeBody)
      .where(eq(profilesTable.userId, req.userId))
      .returning();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [profile] = await db
      .update(profilesTable)
      .set(req.body)
      .where(eq(profilesTable.id, req.params["id"] as string))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
