import {
  pgTable,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";
import { user } from "./auth";

export const bankAccounts = pgTable("bank_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  accountType: text("account_type", {
    enum: ["checking", "savings", "credit_card"],
  }).notNull(),
  lastFourDigits: text("last_four_digits"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  user: one(user, {
    fields: [bankAccounts.userId],
    references: [user.id],
  }),
}));

export const statements = pgTable("statements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bankAccountId: text("bank_account_id").references(() => bankAccounts.id, {
    onDelete: "set null",
  }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  status: text("status", {
    enum: ["uploaded", "processing", "extracted", "categorized", "error"],
  })
    .notNull()
    .default("uploaded"),
  transactionCount: integer("transaction_count").default(0),
  processingStep: text("processing_step"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const statementsRelations = relations(statements, ({ one }) => ({
  user: one(user, { fields: [statements.userId], references: [user.id] }),
  bankAccount: one(bankAccounts, {
    fields: [statements.bankAccountId],
    references: [bankAccounts.id],
  }),
}));
