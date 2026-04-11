import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";
import { user } from "./auth";
import { categories } from "./categories";

export const vendors = pgTable("vendors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  defaultCategoryId: text("default_category_id").references(
    () => categories.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorRules = pgTable("vendor_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vendorCategoryRules = pgTable("vendor_category_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(user, { fields: [vendors.userId], references: [user.id] }),
  defaultCategory: one(categories, {
    fields: [vendors.defaultCategoryId],
    references: [categories.id],
  }),
  rules: many(vendorRules),
  categoryRules: many(vendorCategoryRules),
}));

export const vendorRulesRelations = relations(vendorRules, ({ one }) => ({
  user: one(user, { fields: [vendorRules.userId], references: [user.id] }),
  vendor: one(vendors, {
    fields: [vendorRules.vendorId],
    references: [vendors.id],
  }),
}));

export const vendorCategoryRulesRelations = relations(
  vendorCategoryRules,
  ({ one }) => ({
    user: one(user, {
      fields: [vendorCategoryRules.userId],
      references: [user.id],
    }),
    vendor: one(vendors, {
      fields: [vendorCategoryRules.vendorId],
      references: [vendors.id],
    }),
    category: one(categories, {
      fields: [vendorCategoryRules.categoryId],
      references: [categories.id],
    }),
  })
);
