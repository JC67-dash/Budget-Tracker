import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warrantiesTable = pgTable("warranties", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  productName: text("product_name").notNull(),
  store: text("store"),
  purchaseDate: date("purchase_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  receiptPath: text("receipt_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWarrantySchema = createInsertSchema(warrantiesTable).omit({ id: true, createdAt: true });
export type InsertWarranty = z.infer<typeof insertWarrantySchema>;
export type Warranty = typeof warrantiesTable.$inferSelect;
