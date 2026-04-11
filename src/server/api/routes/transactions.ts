import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import {
  transactions,
  vendors,
  vendorCategoryRules,
} from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

type Env = { Variables: { userId: string } };

export const transactionsRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const { startDate, endDate, categoryId, vendorId } = c.req.query();

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

    const rows = await db.query.transactions.findMany({
      where: and(...conditions),
      with: { category: true, vendor: true, statement: true },
      orderBy: desc(transactions.date),
    });

    return c.json(rows);
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

      // Update the transaction
      const [updated] = await db
        .update(transactions)
        .set({
          categoryId,
          categoryManuallySet: true,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning();

      // If transaction has a vendor, create/update vendor category rule
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

      return c.json(updated);
    }
  );
