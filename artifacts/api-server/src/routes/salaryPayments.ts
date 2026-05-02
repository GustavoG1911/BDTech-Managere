import { Router, Response } from "express";
import { db } from "@workspace/db";
import { salaryPaymentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    const { userId: filterUserId } = req.query as { userId?: string };

    let rows;
    if (isManager) {
      if (filterUserId) {
        rows = await db.select().from(salaryPaymentsTable).where(eq(salaryPaymentsTable.userId, filterUserId));
      } else {
        rows = await db.select().from(salaryPaymentsTable);
      }
    } else {
      rows = await db.select().from(salaryPaymentsTable).where(eq(salaryPaymentsTable.userId, req.userId));
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch salary payments" });
  }
});

router.post("/", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .insert(salaryPaymentsTable)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create salary payment" });
  }
});

router.patch("/:id/confirm", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(salaryPaymentsTable)
      .where(eq(salaryPaymentsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Salary payment not found" });
      return;
    }
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    if (!isManager && existing.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();
    const [row] = await db
      .update(salaryPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(and(eq(salaryPaymentsTable.id, req.params["id"] as string), eq(salaryPaymentsTable.userId, existing.userId)))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to confirm salary payment" });
  }
});

router.patch("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .update(salaryPaymentsTable)
      .set(req.body)
      .where(eq(salaryPaymentsTable.id, req.params["id"] as string))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Salary payment not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update salary payment" });
  }
});

export default router;
