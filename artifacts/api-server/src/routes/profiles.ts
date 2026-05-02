import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
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
    const profiles = await db.select().from(profilesTable);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/me", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/me", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));

    if (existing.length === 0) {
      const [profile] = await db
        .insert(profilesTable)
        .values({ userId: req.userId, ...req.body })
        .returning();
      res.json(profile);
      return;
    }

    const [profile] = await db
      .update(profilesTable)
      .set(req.body)
      .where(eq(profilesTable.userId, req.userId))
      .returning();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/:id", requireAuth, async (req: any, res: Response): Promise<void> => {
  try {
    const [profile] = await db
      .update(profilesTable)
      .set(req.body)
      .where(eq(profilesTable.id, req.params.id as string))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
