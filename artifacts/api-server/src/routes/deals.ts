import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
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
    const deals = await db.select().from(dealsTable).orderBy(dealsTable.createdAt);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.post("/", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const body = req.body;
    const [deal] = await db
      .insert(dealsTable)
      .values({ ...body, userId: body.userId ?? userId })
      .returning();
    res.status(201).json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.get("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, req.params.id as string));
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deal" });
  }
});

router.patch("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [deal] = await db
      .update(dealsTable)
      .set(req.body)
      .where(eq(dealsTable.id, req.params.id as string))
      .returning();
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(dealsTable)
      .where(eq(dealsTable.id, req.params.id as string))
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
