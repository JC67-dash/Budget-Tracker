import { pgTable, serial, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const installmentsTable = pgTable("installments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true, createdAt: true });
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
