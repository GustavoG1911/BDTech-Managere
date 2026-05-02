import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { presentationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
};

router.get("/", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.select().from(presentationsTable).orderBy(presentationsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch presentations" });
  }
});

router.post("/", requireAuth, async (req: any, res: Response): Promise<void> => {
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

router.patch("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .update(presentationsTable)
      .set(req.body)
      .where(eq(presentationsTable.id, req.params.id as string))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update presentation" });
  }
});

router.delete("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(presentationsTable)
      .where(eq(presentationsTable.id, req.params.id as string))
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
