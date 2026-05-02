import { pgTable, text, boolean, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userInvitationsTable = pgTable("user_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  position: text("position").notNull(),
  role: text("role").notNull().default("user"),
  fixedSalary: numeric("fixed_salary", { precision: 15, scale: 2 }).default("0"),
  commissionPercent: numeric("commission_percent", { precision: 8, scale: 2 }).default("0"),
  invitedBy: text("invited_by"),
  status: text("status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  isTestData: boolean("is_test_data").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserInvitationSchema = createInsertSchema(userInvitationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitationsTable.$inferSelect;
