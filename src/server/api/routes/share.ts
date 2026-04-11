import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { shares, transactions, categories } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// Share routes — the GET /:token/data route is public (no auth).
// The POST / and GET / routes need auth but are mounted under the
// public share route group. We check auth manually for those.
import { auth } from "@/lib/auth";

export const shareRoute = new Hono()
  // Public: get shared report data by token
  .get("/:token/data", async (c) => {
    const token = c.req.param("token");

    const share = await db.query.shares.findFirst({
      where: and(eq(shares.token, token), eq(shares.isActive, true)),
    });

    if (!share) return c.json({ error: "Not found" }, 404);

    if (share.expiresAt && share.expiresAt < new Date()) {
      return c.json({ error: "Link expired" }, 410);
    }

    // Return all transactions for the user (accountant view)
    const txns = await db.query.transactions.findMany({
      where: eq(transactions.userId, share.userId),
      with: { category: true, vendor: true },
      orderBy: desc(transactions.date),
    });

    const cats = await db.query.categories.findMany({
      where: eq(categories.userId, share.userId),
    });

    return c.json({ transactions: txns, categories: cats });
  })

  // Protected: create share link
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        label: z.string().optional(),
        expiresInDays: z.number().optional(),
      })
    ),
    async (c) => {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      if (!session) return c.json({ error: "Unauthorized" }, 401);

      const body = c.req.valid("json");
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400000)
        : null;

      const [row] = await db
        .insert(shares)
        .values({
          userId: session.user.id,
          label: body.label,
          expiresAt,
        })
        .returning();

      return c.json(row, 201);
    }
  )

  // Protected: list share links
  .get("/", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const rows = await db.query.shares.findMany({
      where: eq(shares.userId, session.user.id),
      orderBy: desc(shares.createdAt),
    });

    return c.json(rows);
  })

  // Protected: revoke share link
  .delete("/:id", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [updated] = await db
      .update(shares)
      .set({ isActive: false })
      .where(
        and(eq(shares.id, id), eq(shares.userId, session.user.id))
      )
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  });
