import { Router, Response } from "express";
import { db } from "@workspace/db";
import { presentationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    let rows;
    if (isManager) {
      rows = await db.select().from(presentationsTable).orderBy(presentationsTable.createdAt);
    } else {
      rows = await db.select().from(presentationsTable).where(eq(presentationsTable.userId, req.userId)).orderBy(presentationsTable.createdAt);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch presentations" });
  }
});

router.post("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .insert(presentationsTable)
      .values({ userId: req.userId, ...req.body })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create presentation" });
  }
});

router.patch("/:id", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, req.params["id"] as string));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    if (!isManager && existing.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [row] = await db
      .update(presentationsTable)
      .set(req.body)
      .where(eq(presentationsTable.id, req.params["id"] as string))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update presentation" });
  }
});

router.delete("/:id", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(presentationsTable)
      .where(eq(presentationsTable.id, req.params["id"] as string))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete presentation" });
  }
});

export default router;
