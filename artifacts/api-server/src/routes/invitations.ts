import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { userInvitationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

const inviteWriteSchema = z.object({
  email: z.string().email(),
  position: z.string(),
  role: z.enum(["user", "gestor", "admin"]).optional().default("user"),
  fixedSalary: z.number().min(0).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
});

router.get("/", requireAuthWithRole, requireGestor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(userInvitationsTable)
      .orderBy(desc(userInvitationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.post("/", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = inviteWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const { email, position, role, fixedSalary, commissionPercent } = parsed.data;
    const [row] = await db
      .insert(userInvitationsTable)
      .values({
        email: email.toLowerCase().trim(),
        position,
        role,
        fixedSalary: fixedSalary !== undefined ? String(fixedSalary) : "0",
        commissionPercent: commissionPercent !== undefined ? String(commissionPercent) : "0",
        invitedBy: req.userId,
        status: "pending",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

router.patch("/:id/accept", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(userInvitationsTable)
      .where(eq(userInvitationsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    const [row] = await db
      .update(userInvitationsTable)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(userInvitationsTable.id, req.params["id"] as string))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

export default router;
