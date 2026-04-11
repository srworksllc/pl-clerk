import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";
import { user } from "./auth";
import { statements } from "./statements";
import { categories } from "./categories";
import { vendors } from "./vendors";

export const transactions = pgTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    statementId: text("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    vendorId: text("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    date: timestamp("date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    rawText: text("raw_text"),
    aiCategoryConfidence: numeric("ai_category_confidence", {
      precision: 3,
      scale: 2,
    }),
    categoryManuallySet: boolean("category_manually_set")
      .notNull()
      .default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_category_idx").on(table.categoryId),
    index("transactions_vendor_idx").on(table.vendorId),
  ]
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, { fields: [transactions.userId], references: [user.id] }),
  statement: one(statements, {
    fields: [transactions.statementId],
    references: [statements.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  vendor: one(vendors, {
    fields: [transactions.vendorId],
    references: [vendors.id],
  }),
}));
