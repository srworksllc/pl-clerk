-- Create global vendor categories table for collective intelligence categorization
CREATE TABLE IF NOT EXISTS "global_vendor_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "vendor_pattern" text NOT NULL,
  "category_name" text NOT NULL,
  "vote_count" integer NOT NULL DEFAULT 1,
  "last_voted_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "global_vendor_pattern_category_idx"
  ON "global_vendor_categories" ("vendor_pattern", "category_name");
