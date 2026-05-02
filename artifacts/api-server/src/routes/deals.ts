import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuthWithRole, isManagerLevel, AuthRequest } from "../middlewares/auth";
import type { InsertDeal } from "@workspace/db/schema";

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

type DealWriteInput = z.infer<typeof dealWriteSchema>;
type DealPatchInput = z.infer<typeof dealPatchSchema>;

function toNumericString(val: string | number | null | undefined): string | undefined {
  if (val == null) return undefined;
  return String(val);
}

function buildInsertPayload(data: DealWriteInput & { userId: string }): InsertDeal {
  return {
    clientName: data.clientName,
    operation: data.operation,
    closingDate: data.closingDate,
    implantationValue: toNumericString(data.implantationValue),
    monthlyValue: toNumericString(data.monthlyValue),
    isImplantacaoPaid: data.isImplantacaoPaid,
    isImplantacaoPaidByClient: data.isImplantacaoPaidByClient,
    isMensalidadePaid: data.isMensalidadePaid,
    isMensalidadePaidByClient: data.isMensalidadePaidByClient,
    isPaidToUser: data.isPaidToUser,
    isUserConfirmedPayment: data.isUserConfirmedPayment,
    isInstallment: data.isInstallment,
    installmentCount: toNumericString(data.installmentCount),
    installmentDates: data.installmentDates as InsertDeal["installmentDates"],
    userId: data.userId,
    sdrUserId: data.sdrUserId,
    actualPaymentDate: data.actualPaymentDate,
    mensalidadePaymentDate: data.mensalidadePaymentDate,
    implantacaoPaymentDate: data.implantacaoPaymentDate,
    implantationPaymentDate: data.implantationPaymentDate,
    firstPaymentDate: data.firstPaymentDate,
    commissionRateSnapshot: toNumericString(data.commissionRateSnapshot),
    commissionAmountSnapshot: toNumericString(data.commissionAmountSnapshot),
    paymentStatus: data.paymentStatus,
  };
}

function buildUpdatePayload(data: DealPatchInput): Partial<InsertDeal> {
  const patch: Partial<InsertDeal> = {};
  if (data.clientName !== undefined) patch.clientName = data.clientName;
  if (data.operation !== undefined) patch.operation = data.operation;
  if (data.closingDate !== undefined) patch.closingDate = data.closingDate;
  if (data.implantationValue !== undefined) patch.implantationValue = toNumericString(data.implantationValue);
  if (data.monthlyValue !== undefined) patch.monthlyValue = toNumericString(data.monthlyValue);
  if (data.isImplantacaoPaid !== undefined) patch.isImplantacaoPaid = data.isImplantacaoPaid;
  if (data.isImplantacaoPaidByClient !== undefined) patch.isImplantacaoPaidByClient = data.isImplantacaoPaidByClient;
  if (data.isMensalidadePaid !== undefined) patch.isMensalidadePaid = data.isMensalidadePaid;
  if (data.isMensalidadePaidByClient !== undefined) patch.isMensalidadePaidByClient = data.isMensalidadePaidByClient;
  if (data.isPaidToUser !== undefined) patch.isPaidToUser = data.isPaidToUser;
  if (data.isUserConfirmedPayment !== undefined) patch.isUserConfirmedPayment = data.isUserConfirmedPayment;
  if (data.isInstallment !== undefined) patch.isInstallment = data.isInstallment;
  if (data.installmentCount !== undefined) patch.installmentCount = toNumericString(data.installmentCount);
  if (data.installmentDates !== undefined) patch.installmentDates = data.installmentDates as InsertDeal["installmentDates"];
  if (data.sdrUserId !== undefined) patch.sdrUserId = data.sdrUserId;
  if (data.actualPaymentDate !== undefined) patch.actualPaymentDate = data.actualPaymentDate;
  if (data.mensalidadePaymentDate !== undefined) patch.mensalidadePaymentDate = data.mensalidadePaymentDate;
  if (data.implantacaoPaymentDate !== undefined) patch.implantacaoPaymentDate = data.implantacaoPaymentDate;
  if (data.implantationPaymentDate !== undefined) patch.implantationPaymentDate = data.implantationPaymentDate;
  if (data.firstPaymentDate !== undefined) patch.firstPaymentDate = data.firstPaymentDate;
  if (data.commissionRateSnapshot !== undefined) patch.commissionRateSnapshot = toNumericString(data.commissionRateSnapshot);
  if (data.commissionAmountSnapshot !== undefined) patch.commissionAmountSnapshot = toNumericString(data.commissionAmountSnapshot);
  if (data.paymentStatus !== undefined) patch.paymentStatus = data.paymentStatus;
  return patch;
}

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = isManagerLevel(req);
    const deals = isManager
      ? await db.select().from(dealsTable).orderBy(dealsTable.createdAt)
      : await db.select().from(dealsTable)
          .where(or(
            eq(dealsTable.userId, req.userId),
            eq(dealsTable.sdrUserId, req.userId)
          ))
          .orderBy(dealsTable.createdAt);
    res.json(deals);
  } catch {
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
    const payload = buildInsertPayload({ ...parsed.data, userId: targetUserId });
    const [deal] = await db.insert(dealsTable).values(payload).returning();
    res.status(201).json(deal);
  } catch {
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
  } catch {
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
    const payload = buildUpdatePayload(parsed.data);
    const [deal] = await db.update(dealsTable).set(payload).where(eq(dealsTable.id, req.params["id"] as string)).returning();
    res.json(deal);
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

export default router;
