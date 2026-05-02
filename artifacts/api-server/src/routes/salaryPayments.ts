import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { salaryPaymentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
};

router.get("/", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const { userId: filterUserId } = req.query;
    let rows;
    if (filterUserId) {
      rows = await db.select().from(salaryPaymentsTable).where(eq(salaryPaymentsTable.userId, filterUserId as string));
    } else {
      rows = await db.select().from(salaryPaymentsTable);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch salary payments" });
  }
});

router.post("/", requireAuth, async (req: any, res: Response): Promise<void> => {
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

router.patch("/:id/confirm", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const [row] = await db
      .update(salaryPaymentsTable)
      .set({ confirmedByUserAt: now, rejectedByUserAt: null })
      .where(and(eq(salaryPaymentsTable.id, req.params.id), eq(salaryPaymentsTable.userId, req.userId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Salary payment not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to confirm salary payment" });
  }
});

router.patch("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .update(salaryPaymentsTable)
      .set(req.body)
      .where(eq(salaryPaymentsTable.id, req.params.id))
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
