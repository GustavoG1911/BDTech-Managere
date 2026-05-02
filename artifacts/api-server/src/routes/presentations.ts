import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { presentationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

const presentationWriteSchema = z.object({
  operation: z.string(),
  count: z.number().int().optional(),
  date: z.string().optional().nullable(),
});

const presentationPatchSchema = presentationWriteSchema.partial();

router.get("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = req.userRole === "gestor" || req.userRole === "admin";
    const rows = isManager
      ? await db.select().from(presentationsTable).orderBy(presentationsTable.createdAt)
      : await db.select().from(presentationsTable).where(eq(presentationsTable.userId, req.userId)).orderBy(presentationsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch presentations" });
  }
});

router.post("/", requireAuthWithRole, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = presentationWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .insert(presentationsTable)
      .values({ userId: req.userId, ...parsed.data })
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
    const parsed = presentationPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .update(presentationsTable)
      .set(parsed.data)
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
