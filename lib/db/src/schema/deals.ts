import { pgTable, text, boolean, numeric, timestamp, json, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  operation: text("operation").notNull().default("BluePex"),
  closingDate: text("closing_date").notNull().default(""),
  implantationValue: numeric("implantation_value", { precision: 15, scale: 2 }).notNull().default("0"),
  monthlyValue: numeric("monthly_value", { precision: 15, scale: 2 }).notNull().default("0"),
  isImplantacaoPaid: boolean("is_implantacao_paid"),
  isImplantacaoPaidByClient: boolean("is_implantacao_paid_by_client"),
  isMensalidadePaid: boolean("is_mensalidade_paid"),
  isMensalidadePaidByClient: boolean("is_mensalidade_paid_by_client"),
  isPaidToUser: boolean("is_paid_to_user"),
  isUserConfirmedPayment: boolean("is_user_confirmed_payment"),
  isInstallment: boolean("is_installment").notNull().default(false),
  installmentCount: numeric("installment_count", { precision: 5, scale: 0 }).notNull().default("0"),
  installmentDates: json("installment_dates"),
  userId: text("user_id"),
  sdrUserId: text("sdr_user_id"),
  actualPaymentDate: text("actual_payment_date"),
  mensalidadePaymentDate: text("mensalidade_payment_date"),
  implantacaoPaymentDate: text("implantacao_payment_date"),
  implantationPaymentDate: text("implantation_payment_date"),
  firstPaymentDate: text("first_payment_date"),
  commissionRateSnapshot: numeric("commission_rate_snapshot", { precision: 8, scale: 6 }),
  commissionAmountSnapshot: numeric("commission_amount_snapshot", { precision: 15, scale: 2 }),
  paymentStatus: text("payment_status").notNull().default("Pendente"),
  isTestData: boolean("is_test_data").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
