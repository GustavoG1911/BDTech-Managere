import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId: string;
  userRole: string;
  userPosition: string | null;
  param(name: string): string;
}

export function isManagerLevel(req: AuthRequest): boolean {
  return req.userRole === "gestor" || req.userRole === "admin";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId as string | undefined) || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthRequest).userId = userId;
  (req as AuthRequest).userRole = "user";
  (req as AuthRequest).userPosition = null;
  next();
}

export async function requireAuthWithRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId as string | undefined) || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthRequest).userId = userId;
  try {
    const [profile] = await db
      .select({ role: profilesTable.role, position: profilesTable.position })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));
    (req as AuthRequest).userRole = profile?.role ?? "user";
    (req as AuthRequest).userPosition = profile?.position ?? null;
  } catch {
    (req as AuthRequest).userRole = "user";
    (req as AuthRequest).userPosition = null;
  }
  next();
}

export function requireGestor(req: Request, res: Response, next: NextFunction): void {
  const r = req as AuthRequest;
  if (!isManagerLevel(r)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
