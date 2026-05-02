import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuthWithRole, isManagerLevel, AuthRequest } from "../middlewares/auth";

const router = Router();

const numericField = z.union([z.string(), z.number()]).optional().nullable();

const dealWriteSchema = z.object({
  clientName: z.string(),
  operation: z.string().optional(),
  closingDate: z.string().optional(),
  implantationValue: numericField,
  monthlyValue: numericField,
  isImplantacaoPaid: z.boolean().optional().nullable(),
  isImplantacaoPaidByClient: z.boolean().optional().nullable(),
  isMensalidadePaid: z.boolean().optional().nullable(),
  isMensalidadePaidByClient: z.boolean().optional().nullable(),
  isPaidToUser: z.boolean().optional().nullable(),
  isUserConfirmedPayment: z.boolean().optional().nullable(),
  isInstallment: z.boolean().optional(),
  installmentCount: numericField,
  installmentDates: z.unknown().optional(),
  userId: z.string().optional(),
  sdrUserId: z.string().optional().nullable(),
  actualPaymentDate: z.string().optional().nullable(),
  mensalidadePaymentDate: z.string().optional().nullable(),
  implantacaoPaymentDate: z.string().optional().nullable(),
  implantationPaymentDate: z.string().optional().nullable(),
  firstPaymentDate: z.string().optional().nullable(),
  commissionRateSnapshot: numericField,
  commissionAmountSnapshot: numericField,
  paymentStatus: z.string().optional(),
});

const dealPatchSchema = dealWriteSchema.partial().omit({ userId: true });

function normalizeNumericFields(data: Record<string, unknown>): Record<string, unknown> {
  const numFields = ["implantationValue", "monthlyValue", "installmentCount", "commissionRateSnapshot", "commissionAmountSnapshot"];
  const result = { ...data };
  for (const field of numFields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = String(result[field]);
    }
  }
  return result;
}

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = isManagerLevel(req);
    let deals;
    if (isManager) {
      deals = await db.select().from(dealsTable).orderBy(dealsTable.createdAt);
    } else {
      deals = await db.select().from(dealsTable)
        .where(or(
          eq(dealsTable.userId, req.userId),
          eq(dealsTable.sdrUserId, req.userId)
        ))
        .orderBy(dealsTable.createdAt);
    }
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.post("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = dealWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const isManager = isManagerLevel(req);
    const targetUserId = isManager && parsed.data.userId ? parsed.data.userId : req.userId;
    const values = normalizeNumericFields({ ...parsed.data, userId: targetUserId });
    const [deal] = await db
      .insert(dealsTable)
      .values(values as any)
      .returning();
    res.status(201).json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.get("/:id", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, req.params["id"] as string));
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const isManager = isManagerLevel(req);
    if (!isManager && deal.userId !== req.userId && deal.sdrUserId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deal" });
  }
});

router.patch("/:id", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const isManager = isManagerLevel(req);
    if (!isManager && existing.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const parsed = dealPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const values = normalizeNumericFields(parsed.data as Record<string, unknown>);
    const [deal] = await db
      .update(dealsTable)
      .set(values as any)
      .where(eq(dealsTable.id, req.params["id"] as string))
      .returning();
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/:id", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const isManager = isManagerLevel(req);
    if (!isManager && existing.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(dealsTable).where(eq(dealsTable.id, req.params["id"] as string));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

export default router;
