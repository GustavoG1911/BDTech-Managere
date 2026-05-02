import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { commissionPaymentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
};

router.get("/all", requireAuth, async (_req: Request, res: Response): Promise<void> => {
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

router.get("/", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(commissionPaymentsTable)
      .orderBy(commissionPaymentsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch commission payments" });
  }
});

router.post("/upsert", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { dealId, component, competenceMonth, amount, recipientUserId, installmentIndex } = req.body;
    if (!dealId || !component || !competenceMonth || amount == null) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const existing = await db
      .select()
      .from(commissionPaymentsTable)
      .where(
        and(
          eq(commissionPaymentsTable.dealId, dealId),
          eq(commissionPaymentsTable.component, component),
          eq(commissionPaymentsTable.competenceMonth, competenceMonth),
          eq(commissionPaymentsTable.recipientUserId, recipientUserId ?? "")
        )
      );

    if (existing.length > 0) {
      const [row] = await db
        .update(commissionPaymentsTable)
        .set({ amount: String(amount), installmentIndex: installmentIndex ?? null })
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
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[commission-payments/upsert]", err);
    res.status(500).json({ error: "Failed to upsert commission payment" });
  }
});

router.post("/clear", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { dealId, component, competenceMonth, recipientUserId } = req.body;

    const conditions: any[] = [
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

router.post("/confirm-by-recipient", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { dealId, recipientUserId } = req.body;
    const now = new Date();

    const rows = await db
      .update(commissionPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(
        and(
          eq(commissionPaymentsTable.dealId, dealId),
          eq(commissionPaymentsTable.recipientUserId, recipientUserId)
        )
      )
      .returning();

    res.json({ count: rows.length });
  } catch (err) {
    console.error("[commission-payments/confirm-by-recipient]", err);
    res.status(500).json({ error: "Failed to confirm commission payments" });
  }
});

router.patch("/:id/confirm", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { recipientUserId } = req.body;
    const now = new Date();

    const [row] = await db
      .update(commissionPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(
        and(
          eq(commissionPaymentsTable.id, req.params.id),
          eq(commissionPaymentsTable.recipientUserId, recipientUserId)
        )
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Commission payment not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[commission-payments/:id/confirm]", err);
    res.status(500).json({ error: "Failed to confirm commission payment" });
  }
});

router.patch("/:id/reject", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { recipientUserId } = req.body;
    const now = new Date();

    const [row] = await db
      .update(commissionPaymentsTable)
      .set({ rejectedByUserAt: now, confirmedByUserAt: null })
      .where(
        and(
          eq(commissionPaymentsTable.id, req.params.id),
          eq(commissionPaymentsTable.recipientUserId, recipientUserId)
        )
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Commission payment not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[commission-payments/:id/reject]", err);
    res.status(500).json({ error: "Failed to reject commission payment" });
  }
});

router.post("/", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .insert(commissionPaymentsTable)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create commission payment" });
  }
});

router.patch("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .update(commissionPaymentsTable)
      .set(req.body)
      .where(eq(commissionPaymentsTable.id, req.params.id))
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
