import { db } from "@/db";
import { globalVendorCategories } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const MIN_VOTES = 5;
const MIN_CONFIDENCE = 0.8;

// Clean vendor name for matching (uppercase, trim, remove store numbers)
function normalizeVendor(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s*#\d+/g, "")
    .replace(/\s*\d{4,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Look up a vendor in the global database
// Returns the category name if confidence is high enough, null otherwise
export async function lookupGlobalVendor(
  vendorName: string
): Promise<string | null> {
  const pattern = normalizeVendor(vendorName);
  if (!pattern || pattern.length < 3) return null;

  const rows = await db
    .select()
    .from(globalVendorCategories)
    .where(eq(globalVendorCategories.vendorPattern, pattern))
    .orderBy(desc(globalVendorCategories.voteCount));

  if (rows.length === 0) return null;

  const totalVotes = rows.reduce((sum, r) => sum + r.voteCount, 0);
  const topCategory = rows[0];

  // Need enough votes and strong agreement
  if (totalVotes < MIN_VOTES) return null;
  if (topCategory.voteCount / totalVotes < MIN_CONFIDENCE) return null;

  return topCategory.categoryName;
}

// Record a vote — called when a user categorizes a transaction
export async function recordGlobalVote(
  vendorName: string,
  categoryName: string
): Promise<void> {
  const pattern = normalizeVendor(vendorName);
  if (!pattern || pattern.length < 3) return;

  await db
    .insert(globalVendorCategories)
    .values({
      vendorPattern: pattern,
      categoryName,
      voteCount: 1,
      lastVotedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        globalVendorCategories.vendorPattern,
        globalVendorCategories.categoryName,
      ],
      set: {
        voteCount: sql`${globalVendorCategories.voteCount} + 1`,
        lastVotedAt: new Date(),
      },
    });
}

// Batch lookup for multiple vendors at once
export async function lookupGlobalVendors(
  vendorNames: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const name of vendorNames) {
    const category = await lookupGlobalVendor(name);
    if (category) {
      results.set(name, category);
    }
  }

  return results;
}
