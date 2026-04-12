-- Add 'cogs' to the type enum check and add tax_line column
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tax_line text;
-- Remove the old parent_id column (unused)
ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;
