import { db } from "@/db";
import { globalVendorCategories } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

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

export type GlobalPatternRow = {
  vendorPattern: string;
  categoryName: string;
  voteCount: number;
};

// Fetch all global patterns (call once, pass to matchGlobalVendor per txn)
export async function fetchGlobalPatterns(): Promise<GlobalPatternRow[]> {
  try {
    return await db
      .select({
        vendorPattern: globalVendorCategories.vendorPattern,
        categoryName: globalVendorCategories.categoryName,
        voteCount: globalVendorCategories.voteCount,
      })
      .from(globalVendorCategories)
      .orderBy(desc(globalVendorCategories.voteCount));
  } catch (err) {
    console.error("[global-vendors] Failed to fetch patterns:", err);
    return [];
  }
}

// Match a transaction description against pre-fetched global patterns
// Returns the category name if confidence is high enough, null otherwise
export function matchGlobalVendor(
  description: string,
  allPatterns: GlobalPatternRow[]
): string | null {
  const normalized = normalizeVendor(description);
  if (!normalized || normalized.length < 3) return null;
  if (allPatterns.length === 0) return null;

  // Group by vendor pattern, only keep those that match within the description
  const matchedByVendor = new Map<
    string,
    { categoryName: string; voteCount: number }[]
  >();

  for (const row of allPatterns) {
    if (normalized.includes(row.vendorPattern)) {
      const existing = matchedByVendor.get(row.vendorPattern) ?? [];
      existing.push({
        categoryName: row.categoryName,
        voteCount: row.voteCount,
      });
      matchedByVendor.set(row.vendorPattern, existing);
    }
  }

  if (matchedByVendor.size === 0) return null;

  // Pick the longest matching pattern (most specific)
  let bestPattern = "";
  for (const pattern of matchedByVendor.keys()) {
    if (pattern.length > bestPattern.length) {
      bestPattern = pattern;
    }
  }

  const rows = matchedByVendor.get(bestPattern)!;
  const totalVotes = rows.reduce((sum, r) => sum + r.voteCount, 0);
  const topCategory = rows.reduce((best, r) =>
    r.voteCount > best.voteCount ? r : best
  );

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

  try {
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
  } catch (err) {
    console.error("[global-vendors] Failed to record vote:", err);
  }
}

