import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const presentations = pgTable("presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  dealId: uuid("deal_id"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
