import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { vendors, vendorRules, transactions } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

type Env = { Variables: { userId: string } };

export const vendorsRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");

    const rows = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        defaultCategoryId: vendors.defaultCategoryId,
        createdAt: vendors.createdAt,
        totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
        totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
        transactionCount: sql<number>`COUNT(${transactions.id})::int`,
      })
      .from(vendors)
      .leftJoin(transactions, eq(transactions.vendorId, vendors.id))
      .where(eq(vendors.userId, userId))
      .groupBy(vendors.id)
      .orderBy(desc(sql`COUNT(${transactions.id})`));

    return c.json(rows);
  })

  .get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const vendor = await db.query.vendors.findFirst({
      where: and(eq(vendors.id, id), eq(vendors.userId, userId)),
      with: { rules: true, defaultCategory: true },
    });

    if (!vendor) return c.json({ error: "Not found" }, 404);

    const txns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.vendorId, id),
        eq(transactions.userId, userId)
      ),
      with: { category: true },
      orderBy: desc(transactions.date),
    });

    return c.json({ ...vendor, transactions: txns });
  })

  .patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).optional(),
        defaultCategoryId: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");

      const [updated] = await db
        .update(vendors)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(vendors.id, id), eq(vendors.userId, userId)))
        .returning();

      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  )

  .post(
    "/merge",
    zValidator(
      "json",
      z.object({
        keepId: z.string(),
        mergeIds: z.array(z.string()).min(1),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const { keepId, mergeIds } = c.req.valid("json");

      // Reassign transactions from merged vendors to the kept vendor
      for (const mergeId of mergeIds) {
        await db
          .update(transactions)
          .set({ vendorId: keepId })
          .where(
            and(
              eq(transactions.vendorId, mergeId),
              eq(transactions.userId, userId)
            )
          );

        // Move vendor rules to the kept vendor
        await db
          .update(vendorRules)
          .set({ vendorId: keepId })
          .where(
            and(
              eq(vendorRules.vendorId, mergeId),
              eq(vendorRules.userId, userId)
            )
          );

        // Delete the merged vendor
        await db
          .delete(vendors)
          .where(
            and(eq(vendors.id, mergeId), eq(vendors.userId, userId))
          );
      }

      return c.json({ success: true });
    }
  );
