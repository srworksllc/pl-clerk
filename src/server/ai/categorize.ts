import { callClaude } from "./providers";
import { CATEGORIZATION_SYSTEM_PROMPT } from "./prompts";
import { db } from "@/db";
import {
  categories,
  vendors,
  vendorRules,
  vendorCategoryRules,
  transactions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  fetchGlobalPatterns,
  matchGlobalVendor,
  recordGlobalVote,
} from "./global-vendors";

interface TransactionInput {
  description: string;
  index: number;
}

interface CategoryResult {
  index: number;
  categoryId: string | null;
  vendorName: string | null;
}

// In-memory categorization — returns category assignments without touching DB
export async function categorizeInMemory(
  userId: string,
  txns: TransactionInput[]
): Promise<CategoryResult[]> {
  const userVendorRules = await db.query.vendorRules.findMany({
    where: eq(vendorRules.userId, userId),
    with: { vendor: true },
  });

  const userCategoryRules = await db.query.vendorCategoryRules.findMany({
    where: eq(vendorCategoryRules.userId, userId),
  });

  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
  });

  const categoryNames = userCategories.map((c) => c.name);
  const results: CategoryResult[] = [];
  const needsGlobal: TransactionInput[] = [];

  // Pass 1: User's personal vendor rules (always wins)
  for (const txn of txns) {
    const matchedRule = userVendorRules.find((rule) =>
      txn.description.toUpperCase().includes(rule.pattern.toUpperCase())
    );

    if (matchedRule) {
      const catRule = userCategoryRules.find(
        (cr) => cr.vendorId === matchedRule.vendorId
      );
      results.push({
        index: txn.index,
        categoryId: catRule?.categoryId ?? matchedRule.vendor.defaultCategoryId,
        vendorName: matchedRule.vendor.name,
      });
    } else {
      needsGlobal.push(txn);
    }
  }

  if (needsGlobal.length === 0) return results;

  // Pass 2: Global vendor database (collective intelligence)
  const globalPatterns = await fetchGlobalPatterns();
  const needsAi: TransactionInput[] = [];
  for (const txn of needsGlobal) {
    const globalCategoryName = matchGlobalVendor(txn.description, globalPatterns);

    if (globalCategoryName) {
      const category = userCategories.find(
        (c) => c.name.toLowerCase() === globalCategoryName.toLowerCase()
      );
      if (category) {
        console.log(`[categorize] Global DB match: "${txn.description}" → ${globalCategoryName}`);
        results.push({
          index: txn.index,
          categoryId: category.id,
          vendorName: null,
        });
        continue;
      }
    }
    needsAi.push(txn);
  }

  if (needsAi.length === 0) return results;

  // Pass 3: AI categorization in parallel batches (fallback)
  console.log(`[categorize] ${needsAi.length} transactions need AI (${txns.length - needsAi.length} resolved by rules/global)`);
  const BATCH_SIZE = 30;
  const MAX_CONCURRENT = 3;
  const MAX_RETRIES = 2;

  const batches: TransactionInput[][] = [];
  for (let i = 0; i < needsAi.length; i += BATCH_SIZE) {
    batches.push(needsAi.slice(i, i + BATCH_SIZE));
  }

  // Process batches in groups of MAX_CONCURRENT
  for (let g = 0; g < batches.length; g += MAX_CONCURRENT) {
    const group = batches.slice(g, g + MAX_CONCURRENT);
    const promises = group.map(async (batch, groupIdx) => {
      const batchNum = g + groupIdx + 1;
      const txnData = batch.map((t) => ({
        id: String(t.index),
        description: t.description,
      }));

      console.log(`[categorize] AI batch ${batchNum}/${batches.length}: ${batch.length} transactions`);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const text = await callClaude(
            [
              {
                role: "user",
                content: `Categories: ${categoryNames.join(", ")}\n\nTransactions:\n${JSON.stringify(txnData)}`,
              },
            ],
            {
              system: CATEGORIZATION_SYSTEM_PROMPT,
              maxTokens: 4096,
              model: "claude-haiku-4-5-20251001",
            }
          );

          const parsed = parseCategorizeResponse(text);

          for (const item of parsed) {
            if (!item.categoryName) {
              results.push({
                index: parseInt(item.transactionId),
                categoryId: null,
                vendorName: item.vendorName || null,
              });
              continue;
            }

            const category = userCategories.find(
              (c) => c.name.toLowerCase() === item.categoryName!.toLowerCase()
            );

            results.push({
              index: parseInt(item.transactionId),
              categoryId: category?.id ?? null,
              vendorName: item.vendorName || null,
            });
          }
          return; // Success — exit retry loop
        } catch (err) {
          if (attempt === MAX_RETRIES) {
            console.error(`[categorize] Batch ${batchNum} failed after ${MAX_RETRIES + 1} attempts:`, err);
            for (const t of batch) {
              results.push({ index: t.index, categoryId: null, vendorName: null });
            }
          } else {
            console.warn(`[categorize] Batch ${batchNum} attempt ${attempt + 1} failed, retrying...`);
          }
        }
      }
    });
    await Promise.all(promises);
  }

  return results;
}

// Post-insert: create vendors, vendor rules, and record global votes
export async function createVendorRules(
  userId: string,
  txns: Array<{
    id: string;
    description: string;
    categoryId: string | null;
    vendorName: string | null;
  }>
) {
  for (const txn of txns) {
    if (!txn.vendorName) continue;

    let vendor = await db.query.vendors.findFirst({
      where: and(eq(vendors.userId, userId), eq(vendors.name, txn.vendorName)),
    });

    if (!vendor) {
      const [created] = await db
        .insert(vendors)
        .values({
          userId,
          name: txn.vendorName,
          defaultCategoryId: txn.categoryId,
        })
        .returning();
      vendor = created;

      await db.insert(vendorRules).values({
        userId,
        vendorId: vendor.id,
        pattern: txn.description.toUpperCase().slice(0, 30),
      });
    }

    await db
      .update(transactions)
      .set({ vendorId: vendor.id })
      .where(eq(transactions.id, txn.id));

    // Record global vote if categorized
    if (txn.categoryId) {
      const cat = await db.query.categories.findFirst({
        where: eq(categories.id, txn.categoryId),
      });
      if (cat) {
        await recordGlobalVote(txn.vendorName, cat.name);
      }
    }
  }
}

// DB-based categorization for re-categorizing existing transactions
export async function categorizeTransactions(
  userId: string,
  txns: {
    id: string;
    description: string;
    categoryId: string | null;
    categoryManuallySet: boolean;
    vendorId: string | null;
  }[]
) {
  const uncategorized = txns.filter(
    (t) => !t.categoryManuallySet && !t.categoryId
  );
  if (uncategorized.length === 0) return;

  const inputs = uncategorized.map((t, i) => ({
    description: t.description,
    index: i,
  }));

  const results = await categorizeInMemory(userId, inputs);

  for (const result of results) {
    const txn = uncategorized[result.index];
    if (!txn || !result.categoryId) continue;

    await db
      .update(transactions)
      .set({
        categoryId: result.categoryId,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, txn.id));
  }
}

interface CategorizationResult {
  transactionId: string;
  categoryName: string | null;
  vendorName: string;
  confidence: number;
}

function parseCategorizeResponse(text: string): CategorizationResult[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed)
    ? parsed
    : parsed.results ?? parsed.categorizations ?? [];
}
