import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { commissionPaymentsTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, isManagerLevel, AuthRequest } from "../middlewares/auth";

const router = Router();

const upsertSchema = z.object({
  dealId: z.string(),
  component: z.string(),
  competenceMonth: z.string(),
  amount: z.union([z.string(), z.number()]),
  recipientUserId: z.string().optional().nullable(),
  installmentIndex: z.number().int().optional().nullable(),
});

const clearSchema = z.object({
  dealId: z.string(),
  component: z.string(),
  competenceMonth: z.string(),
  recipientUserId: z.string().optional().nullable(),
});

const confirmByRecipientSchema = z.object({
  dealId: z.string(),
  recipientUserId: z.string(),
});

const patchSchema = z.object({
  amount: z.string().optional(),
});

router.get("/all", requireAuthWithRole, requireGestor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(commissionPaymentsTable)
      .orderBy(commissionPaymentsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all commission payments" });
  }
});

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = isManagerLevel(req);
    const rows = isManager
      ? await db.select().from(commissionPaymentsTable).orderBy(commissionPaymentsTable.createdAt)
      : await db.select().from(commissionPaymentsTable)
          .where(eq(commissionPaymentsTable.recipientUserId, req.userId))
          .orderBy(commissionPaymentsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch commission payments" });
  }
});

router.post("/upsert", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const { dealId, component, competenceMonth, amount, recipientUserId, installmentIndex } = parsed.data;

    const recipientCondition = recipientUserId != null
      ? eq(commissionPaymentsTable.recipientUserId, recipientUserId)
      : isNull(commissionPaymentsTable.recipientUserId);

    const whereConditions = [
      eq(commissionPaymentsTable.dealId, dealId),
      eq(commissionPaymentsTable.component, component),
      eq(commissionPaymentsTable.competenceMonth, competenceMonth),
      recipientCondition,
    ];
    if (installmentIndex != null) {
      whereConditions.push(eq(commissionPaymentsTable.installmentIndex, installmentIndex));
    }
    const existing = await db
      .select()
      .from(commissionPaymentsTable)
      .where(and(...whereConditions));

    const now = new Date();
    if (existing.length > 0) {
      const [row] = await db
        .update(commissionPaymentsTable)
        .set({ amount: String(amount), installmentIndex: installmentIndex ?? null, paidByDirectorAt: now })
        .where(eq(commissionPaymentsTable.id, existing[0].id))
        .returning();
      res.json(row);
      return;
    }

    const [row] = await db
      .insert(commissionPaymentsTable)
      .values({
        dealId,
        component,
        competenceMonth,
        amount: String(amount),
        recipientUserId: recipientUserId ?? null,
        installmentIndex: installmentIndex ?? null,
        paidByDirectorAt: now,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[commission-payments/upsert]", err);
    res.status(500).json({ error: "Failed to upsert commission payment" });
  }
});

router.post("/clear", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = clearSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const { dealId, component, competenceMonth, recipientUserId } = parsed.data;

    const conditions: ReturnType<typeof eq>[] = [
      eq(commissionPaymentsTable.dealId, dealId),
      eq(commissionPaymentsTable.component, component),
      eq(commissionPaymentsTable.competenceMonth, competenceMonth),
    ];
    if (recipientUserId) {
      conditions.push(eq(commissionPaymentsTable.recipientUserId, recipientUserId));
    }

    await db.delete(commissionPaymentsTable).where(and(...conditions));
    res.json({ success: true });
  } catch (err) {
    console.error("[commission-payments/clear]", err);
    res.status(500).json({ error: "Failed to clear commission payment" });
  }
});

router.post("/confirm-by-recipient", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = confirmByRecipientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const { dealId, recipientUserId } = parsed.data;
    const isManager = isManagerLevel(req);
    if (!isManager && recipientUserId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();

    const rows = await db
      .update(commissionPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(and(
        eq(commissionPaymentsTable.dealId, dealId),
        eq(commissionPaymentsTable.recipientUserId, recipientUserId)
      ))
      .returning();

    res.json({ count: rows.length });
  } catch (err) {
    console.error("[commission-payments/confirm-by-recipient]", err);
    res.status(500).json({ error: "Failed to confirm commission payments" });
  }
});

router.patch("/:id/confirm", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(commissionPaymentsTable)
      .where(eq(commissionPaymentsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Commission payment not found" });
      return;
    }
    const isManager = isManagerLevel(req);
    if (!isManager && existing.recipientUserId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();
    const [row] = await db
      .update(commissionPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(eq(commissionPaymentsTable.id, req.params["id"] as string))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[commission-payments/:id/confirm]", err);
    res.status(500).json({ error: "Failed to confirm commission payment" });
  }
});

router.patch("/:id/reject", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(commissionPaymentsTable)
      .where(eq(commissionPaymentsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Commission payment not found" });
      return;
    }
    const isManager = isManagerLevel(req);
    if (!isManager && existing.recipientUserId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();
    const [row] = await db
      .update(commissionPaymentsTable)
      .set({ rejectedByUserAt: now, confirmedByUserAt: null })
      .where(eq(commissionPaymentsTable.id, req.params["id"] as string))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[commission-payments/:id/reject]", err);
    res.status(500).json({ error: "Failed to reject commission payment" });
  }
});

router.post("/", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const { dealId, component, competenceMonth, amount, recipientUserId, installmentIndex } = parsed.data;
    const [row] = await db
      .insert(commissionPaymentsTable)
      .values({
        dealId,
        component,
        competenceMonth,
        amount: String(amount),
        recipientUserId: recipientUserId ?? null,
        installmentIndex: installmentIndex ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create commission payment" });
  }
});

router.patch("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .update(commissionPaymentsTable)
      .set(parsed.data)
      .where(eq(commissionPaymentsTable.id, req.params["id"] as string))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update commission payment" });
  }
});

export default router;
