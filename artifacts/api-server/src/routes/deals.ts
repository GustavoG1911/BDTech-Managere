import { Router, Response } from "express";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    let deals;
    if (isManager) {
      deals = await db.select().from(dealsTable).orderBy(dealsTable.createdAt);
    } else {
      deals = await db.select().from(dealsTable).where(eq(dealsTable.userId, req.userId)).orderBy(dealsTable.createdAt);
    }
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.post("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    const targetUserId = isManager && body.userId ? body.userId : req.userId;
    const [deal] = await db
      .insert(dealsTable)
      .values({ ...body, userId: targetUserId })
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
    const { userId: _uid, ...safeBody } = req.body;
    const updateData = isManager ? req.body : safeBody;
    const [deal] = await db
      .update(dealsTable)
      .set(updateData)
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
