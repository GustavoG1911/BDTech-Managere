import { Router, Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const notificationWriteSchema = z.object({
  dealId: z.string().optional().nullable(),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean().optional(),
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId))
      .orderBy(notificationsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = notificationWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .insert(notificationsTable)
      .values({ userId: req.userId, ...parsed.data })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create notification" });
  }
});

router.patch("/read-all", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

router.patch("/:id/read", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, req.params["id"] as string));
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [row] = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, req.params["id"] as string))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

export default router;
