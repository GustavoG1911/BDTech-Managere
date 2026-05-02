import { pgTable, text, boolean, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  fullName: text("full_name"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").default("user"),
  position: text("position"),
  jobTitle: text("job_title"),
  commissionPercent: numeric("commission_percent", { precision: 8, scale: 2 }),
  fixedSalary: numeric("fixed_salary", { precision: 15, scale: 2 }),
  isTestData: boolean("is_test_data").default(false),
  isSandbox: boolean("is_sandbox").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
