import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";
import { user } from "./auth";

export const shares = pgTable("shares", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token")
    .notNull()
    .unique()
    .$defaultFn(() => nanoid(32)),
  label: text("label"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sharesRelations = relations(shares, ({ one }) => ({
  user: one(user, { fields: [shares.userId], references: [user.id] }),
}));
