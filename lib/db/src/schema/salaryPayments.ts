import { pgTable, text, boolean, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salaryPaymentsTable = pgTable("salary_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  referenceMonth: text("reference_month").notNull(),
  expectedPaymentDate: text("expected_payment_date"),
  paymentDate: text("payment_date"),
  isPaidByGestor: boolean("is_paid_by_gestor").notNull().default(false),
  confirmedByUserAt: timestamp("confirmed_by_user_at", { withTimezone: true }),
  rejectedByUserAt: timestamp("rejected_by_user_at", { withTimezone: true }),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalaryPaymentSchema = createInsertSchema(salaryPaymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalaryPayment = z.infer<typeof insertSalaryPaymentSchema>;
export type SalaryPayment = typeof salaryPaymentsTable.$inferSelect;
