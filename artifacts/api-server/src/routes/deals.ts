import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

const dealWriteSchema = z.object({
  clientName: z.string(),
  operation: z.string().optional(),
  closingDate: z.string().optional(),
  implantationValue: z.string().optional(),
  monthlyValue: z.string().optional(),
  isImplantacaoPaid: z.boolean().optional().nullable(),
  isImplantacaoPaidByClient: z.boolean().optional().nullable(),
  isMensalidadePaid: z.boolean().optional().nullable(),
  isMensalidadePaidByClient: z.boolean().optional().nullable(),
  isPaidToUser: z.boolean().optional().nullable(),
  isUserConfirmedPayment: z.boolean().optional().nullable(),
  isInstallment: z.boolean().optional(),
  installmentCount: z.string().optional(),
  installmentDates: z.unknown().optional(),
  userId: z.string().optional(),
  sdrUserId: z.string().optional().nullable(),
  actualPaymentDate: z.string().optional().nullable(),
  mensalidadePaymentDate: z.string().optional().nullable(),
  implantacaoPaymentDate: z.string().optional().nullable(),
  implantationPaymentDate: z.string().optional().nullable(),
  firstPaymentDate: z.string().optional().nullable(),
  commissionRateSnapshot: z.string().optional().nullable(),
  commissionAmountSnapshot: z.string().optional().nullable(),
  paymentStatus: z.string().optional(),
});

const dealPatchSchema = dealWriteSchema.partial().omit({ userId: true });

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    const deals = isManager
      ? await db.select().from(dealsTable).orderBy(dealsTable.createdAt)
      : await db.select().from(dealsTable).where(eq(dealsTable.userId, req.userId)).orderBy(dealsTable.createdAt);
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
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    const targetUserId = isManager && parsed.data.userId ? parsed.data.userId : req.userId;
    const [deal] = await db
      .insert(dealsTable)
      .values({ ...parsed.data, userId: targetUserId })
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
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    if (!isManager && deal.userId !== req.userId) {
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
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    if (!isManager && existing.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const parsed = dealPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const [deal] = await db
      .update(dealsTable)
      .set(parsed.data)
      .where(eq(dealsTable.id, req.params["id"] as string))
      .returning();
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(dealsTable)
      .where(eq(dealsTable.id, req.params["id"] as string))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

export default router;
