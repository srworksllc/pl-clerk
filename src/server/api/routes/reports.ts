import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { reports, transactions, categories } from "@/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { generateExcel, generateCsv } from "@/lib/export";

type Env = { Variables: { userId: string } };

export const reportsRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await db.query.reports.findMany({
      where: eq(reports.userId, userId),
      orderBy: desc(reports.createdAt),
    });
    return c.json(rows);
  })

  .post(
    "/generate",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        type: z.enum(["monthly_pl", "quarterly_pl", "annual_pl", "custom"]),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const start = new Date(body.periodStart);
      const end = new Date(body.periodEnd);

      // Fetch transactions in range
      const txns = await db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, userId),
          gte(transactions.date, start),
          lte(transactions.date, end)
        ),
        with: { category: true, vendor: true },
        orderBy: transactions.date,
      });

      // Build P&L data
      const incomeByCategory: Record<string, number> = {};
      const expenseByCategory: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      for (const txn of txns) {
        const categoryName = txn.category?.name ?? "Uncategorized";
        const amount = parseFloat(txn.amount);

        if (txn.type === "income") {
          incomeByCategory[categoryName] =
            (incomeByCategory[categoryName] ?? 0) + amount;
          totalIncome += amount;
        } else {
          expenseByCategory[categoryName] =
            (expenseByCategory[categoryName] ?? 0) + amount;
          totalExpenses += amount;
        }
      }

      const data = {
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        incomeByCategory,
        expenseByCategory,
        transactionCount: txns.length,
      };

      const [row] = await db
        .insert(reports)
        .values({
          userId,
          name: body.name,
          type: body.type,
          periodStart: start,
          periodEnd: end,
          data,
        })
        .returning();

      return c.json(row, 201);
    }
  )

  .get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row = await db.query.reports.findFirst({
      where: and(eq(reports.id, id), eq(reports.userId, userId)),
    });

    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  })

  .get("/:id/export", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const format = c.req.query("format") ?? "xlsx";

    const row = await db.query.reports.findFirst({
      where: and(eq(reports.id, id), eq(reports.userId, userId)),
    });

    if (!row) return c.json({ error: "Not found" }, 404);

    if (format === "csv") {
      const csv = generateCsv(row.data as Record<string, unknown>);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${row.name}.csv"`,
        },
      });
    }

    const buffer = await generateExcel(row.data as Record<string, unknown>);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${row.name}.xlsx"`,
      },
    });
  })

  .delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const deleted = await db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.userId, userId)))
      .returning();

    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  });
