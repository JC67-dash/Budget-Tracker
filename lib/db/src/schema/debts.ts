import { pgTable, serial, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debtsTable = pgTable("debts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  creditor: text("creditor"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  borrowedDate: date("borrowed_date").notNull(),
  dueDate: date("due_date").notNull(),
  interestPercent: numeric("interest_percent", { precision: 6, scale: 2 }),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDebtSchema = createInsertSchema(debtsTable).omit({ id: true, createdAt: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type Debt = typeof debtsTable.$inferSelect;
