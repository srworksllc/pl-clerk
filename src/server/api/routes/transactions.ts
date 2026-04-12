import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import {
  transactions,
  categories,
  vendorCategoryRules,
} from "@/db/schema";
import { eq, and, desc, gte, lte, isNull, sql } from "drizzle-orm";
import { recordGlobalVote } from "@/server/ai/global-vendors";

type Env = { Variables: { userId: string } };

export const transactionsRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const { startDate, endDate, categoryId, vendorId, uncategorized } =
      c.req.query();

    const conditions = [eq(transactions.userId, userId)];

    if (startDate) {
      conditions.push(gte(transactions.date, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(transactions.date, new Date(endDate)));
    }
    if (categoryId) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }
    if (vendorId) {
      conditions.push(eq(transactions.vendorId, vendorId));
    }
    if (uncategorized === "true") {
      conditions.push(isNull(transactions.categoryId));
    }

    const rows = await db.query.transactions.findMany({
      where: and(...conditions),
      with: { category: true, vendor: true },
      orderBy: desc(transactions.date),
    });

    return c.json(rows);
  })

  .get("/stats", async (c) => {
    const userId = c.get("userId");

    const [result] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        uncategorized: sql<number>`COUNT(*) FILTER (WHERE ${transactions.categoryId} IS NULL)::int`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    return c.json(result);
  })

  .patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        categoryId: z.string().nullable().optional(),
        vendorId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");

      const [updated] = await db
        .update(transactions)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, id), eq(transactions.userId, userId))
        )
        .returning();

      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  )

  .patch(
    "/:id/category",
    zValidator(
      "json",
      z.object({
        categoryId: z.string(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const { categoryId } = c.req.valid("json");

      const txn = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        ),
      });

      if (!txn) return c.json({ error: "Not found" }, 404);

      const [updated] = await db
        .update(transactions)
        .set({
          categoryId,
          categoryManuallySet: true,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning();

      if (txn.vendorId) {
        await db
          .insert(vendorCategoryRules)
          .values({
            userId,
            vendorId: txn.vendorId,
            categoryId,
          })
          .onConflictDoUpdate({
            target: [vendorCategoryRules.vendorId, vendorCategoryRules.userId],
            set: { categoryId },
          });
      }

      // Record global vote for collective intelligence
      const cat = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
      });
      if (cat) {
        const vendorName = (await db.query.transactions.findFirst({
          where: eq(transactions.id, id),
          with: { vendor: true },
        }))?.vendor?.name;
        if (vendorName) {
          await recordGlobalVote(vendorName, cat.name);
        }
      }

      return c.json(updated);
    }
  )

  // Batch categorize by vendor name — categorizes all transactions matching a vendor
  .post(
    "/batch-categorize",
    zValidator(
      "json",
      z.object({
        vendorName: z.string(),
        categoryId: z.string(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const { vendorName, categoryId } = c.req.valid("json");

      // Find all uncategorized transactions matching this vendor
      const allTxns = await db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, userId),
          isNull(transactions.categoryId)
        ),
        with: { vendor: true },
      });

      const matching = allTxns.filter(
        (t) => (t.vendor?.name ?? "Unknown") === vendorName
      );

      if (matching.length === 0) {
        return c.json({ error: "No matching transactions" }, 404);
      }

      // Update all matching transactions
      for (const txn of matching) {
        await db
          .update(transactions)
          .set({
            categoryId,
            categoryManuallySet: true,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, txn.id));

        // Create vendor category rule if vendor exists
        if (txn.vendorId) {
          await db
            .insert(vendorCategoryRules)
            .values({
              userId,
              vendorId: txn.vendorId,
              categoryId,
            })
            .onConflictDoUpdate({
              target: [vendorCategoryRules.vendorId, vendorCategoryRules.userId],
              set: { categoryId },
            });
        }
      }

      // Record global vote for collective intelligence
      const cat = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
      });
      if (cat) {
        await recordGlobalVote(vendorName, cat.name);
      }

      return c.json({ success: true, count: matching.length });
    }
  );
