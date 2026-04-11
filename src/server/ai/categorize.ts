import { anthropic, openai } from "./providers";
import { CATEGORIZATION_SYSTEM_PROMPT } from "./prompts";
import { db } from "@/db";
import {
  categories,
  vendors,
  vendorRules,
  vendorCategoryRules,
  transactions,
} from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";

interface TransactionRow {
  id: string;
  description: string;
  categoryId: string | null;
  categoryManuallySet: boolean;
  vendorId: string | null;
}

export async function categorizeTransactions(
  userId: string,
  txns: TransactionRow[]
) {
  // Skip already manually categorized transactions
  const uncategorized = txns.filter((t) => !t.categoryManuallySet);
  if (uncategorized.length === 0) return;

  // Load user's vendor rules and category rules
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

  // First pass: apply vendor rules (deterministic)
  const needsAi: TransactionRow[] = [];

  for (const txn of uncategorized) {
    const matchedRule = userVendorRules.find((rule) =>
      txn.description.toUpperCase().includes(rule.pattern.toUpperCase())
    );

    if (matchedRule) {
      // Check if there's a category override for this vendor
      const catRule = userCategoryRules.find(
        (cr) => cr.vendorId === matchedRule.vendorId
      );

      await db
        .update(transactions)
        .set({
          vendorId: matchedRule.vendorId,
          categoryId: catRule?.categoryId ?? matchedRule.vendor.defaultCategoryId,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, txn.id));
    } else {
      needsAi.push(txn);
    }
  }

  if (needsAi.length === 0) return;

  // Second pass: AI categorization for remaining
  const txnData = needsAi.map((t) => ({
    id: t.id,
    description: t.description,
  }));

  try {
    const results = await categorizeWithClaude(txnData, categoryNames);
    await applyCategorizationResults(userId, results, userCategories);
  } catch {
    try {
      const results = await categorizeWithOpenAI(txnData, categoryNames);
      await applyCategorizationResults(userId, results, userCategories);
    } catch {
      // If both fail, leave uncategorized
    }
  }
}

interface CategorizationResult {
  transactionId: string;
  categoryName: string;
  vendorName: string;
  confidence: number;
}

async function categorizeWithClaude(
  txns: { id: string; description: string }[],
  categoryNames: string[]
): Promise<CategorizationResult[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: CATEGORIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Categories: ${categoryNames.join(", ")}\n\nTransactions:\n${JSON.stringify(txns, null, 2)}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "[]";
  return parseCategorizeResponse(text);
}

async function categorizeWithOpenAI(
  txns: { id: string; description: string }[],
  categoryNames: string[]
): Promise<CategorizationResult[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      { role: "system", content: CATEGORIZATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Categories: ${categoryNames.join(", ")}\n\nTransactions:\n${JSON.stringify(txns, null, 2)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "[]";
  return parseCategorizeResponse(text);
}

function parseCategorizeResponse(text: string): CategorizationResult[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : parsed.results ?? parsed.categorizations ?? [];
}

async function applyCategorizationResults(
  userId: string,
  results: CategorizationResult[],
  userCategories: { id: string; name: string }[]
) {
  for (const result of results) {
    const category = userCategories.find(
      (c) => c.name.toLowerCase() === result.categoryName.toLowerCase()
    );

    if (!category) continue;

    // Find or create vendor
    let vendor = await db.query.vendors.findFirst({
      where: and(
        eq(vendors.userId, userId),
        eq(vendors.name, result.vendorName)
      ),
    });

    if (!vendor && result.vendorName) {
      const [created] = await db
        .insert(vendors)
        .values({
          userId,
          name: result.vendorName,
          defaultCategoryId: category.id,
        })
        .returning();
      vendor = created;

      // Create vendor rule from the transaction description
      const txn = await db.query.transactions.findFirst({
        where: eq(transactions.id, result.transactionId),
      });

      if (txn) {
        await db.insert(vendorRules).values({
          userId,
          vendorId: vendor.id,
          pattern: txn.description.toUpperCase().slice(0, 30),
        });
      }
    }

    // Update the transaction
    await db
      .update(transactions)
      .set({
        categoryId: category.id,
        vendorId: vendor?.id ?? null,
        aiCategoryConfidence: result.confidence.toString(),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, result.transactionId));
  }
}
