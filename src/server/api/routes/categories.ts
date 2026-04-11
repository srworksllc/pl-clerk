import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

type Env = { Variables: { userId: string } };

export const categoriesRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: [asc(categories.type), asc(categories.sortOrder)],
    });
    return c.json(rows);
  })

  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        type: z.enum(["income", "expense"]),
        parentId: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");

      const [row] = await db
        .insert(categories)
        .values({ ...body, userId })
        .returning();

      return c.json(row, 201);
    }
  )

  .patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).optional(),
        sortOrder: z.number().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");

      const [updated] = await db
        .update(categories)
        .set({ ...body, updatedAt: new Date() })
        .where(
          and(eq(categories.id, id), eq(categories.userId, userId))
        )
        .returning();

      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  )

  .delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    // Nullify transactions that reference this category
    await db
      .update(transactions)
      .set({ categoryId: null })
      .where(
        and(
          eq(transactions.categoryId, id),
          eq(transactions.userId, userId)
        )
      );

    const deleted = await db
      .delete(categories)
      .where(
        and(eq(categories.id, id), eq(categories.userId, userId))
      )
      .returning();

    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  });
