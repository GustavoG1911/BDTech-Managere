import { pgTable, text, boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const presentationsTable = pgTable("presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  operation: text("operation").notNull(),
  count: integer("count").default(0),
  date: text("date"),
  isTestData: boolean("is_test_data").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPresentationSchema = createInsertSchema(presentationsTable).omit({ id: true, createdAt: true });
export type InsertPresentation = z.infer<typeof insertPresentationSchema>;
export type Presentation = typeof presentationsTable.$inferSelect;
