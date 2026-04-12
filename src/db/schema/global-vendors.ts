import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const globalVendorCategories = pgTable(
  "global_vendor_categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    vendorPattern: text("vendor_pattern").notNull(),
    categoryName: text("category_name").notNull(),
    voteCount: integer("vote_count").notNull().default(1),
    lastVotedAt: timestamp("last_voted_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("global_vendor_pattern_category_idx").on(
      table.vendorPattern,
      table.categoryName
    ),
  ]
);
