import { pgTable, text, boolean, numeric, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionPaymentsTable = pgTable("commission_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: text("deal_id").notNull(),
  component: text("component").notNull(),
  competenceMonth: text("competence_month").notNull(),
  installmentIndex: integer("installment_index"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  recipientUserId: text("recipient_user_id"),
  paidByDirectorAt: timestamp("paid_by_director_at", { withTimezone: true }),
  confirmedByUserAt: timestamp("confirmed_by_user_at", { withTimezone: true }),
  rejectedByUserAt: timestamp("rejected_by_user_at", { withTimezone: true }),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommissionPaymentSchema = createInsertSchema(commissionPaymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommissionPayment = z.infer<typeof insertCommissionPaymentSchema>;
export type CommissionPayment = typeof commissionPaymentsTable.$inferSelect;
