import { Hono } from "hono";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { generateExcel, generateCsv } from "@/lib/export";

type Env = { Variables: { userId: string } };

interface PLData {
  periodStart: string;
  periodEnd: string;
  incomeByCategory: Record<string, number>;
  cogsByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  totalIncome: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  uncategorizedCount: number;
}

function buildPLData(
  txns: {
    amount: string;
    type: string;
    categoryId: string | null;
    category: { name: string; type: string; taxLine: string | null } | null;
  }[],
  startDate: string,
  endDate: string
): PLData {
  const incomeByCategory: Record<string, number> = {};
  const cogsByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  let totalIncome = 0;
  let totalCogs = 0;
  let totalExpenses = 0;
  let uncategorizedCount = 0;

  for (const txn of txns) {
    const amount = parseFloat(txn.amount);

    if (!txn.category) {
      uncategorizedCount++;
      if (txn.type === "income") totalIncome += amount;
      else totalExpenses += amount;
      const bucket = txn.type === "income" ? incomeByCategory : expenseByCategory;
      bucket["Uncategorized"] = (bucket["Uncategorized"] ?? 0) + amount;
      continue;
    }

    const categoryName = txn.category.name;
    const categoryType = txn.category.type;

    if (categoryType === "income") {
      incomeByCategory[categoryName] = (incomeByCategory[categoryName] ?? 0) + amount;
      totalIncome += amount;
    } else if (categoryType === "cogs") {
      cogsByCategory[categoryName] = (cogsByCategory[categoryName] ?? 0) + amount;
      totalCogs += amount;
    } else {
      expenseByCategory[categoryName] = (expenseByCategory[categoryName] ?? 0) + amount;
      totalExpenses += amount;
    }
  }

  return {
    periodStart: startDate,
    periodEnd: endDate,
    incomeByCategory,
    cogsByCategory,
    expenseByCategory,
    totalIncome,
    totalCogs,
    grossProfit: totalIncome - totalCogs,
    totalExpenses,
    netProfit: totalIncome - totalCogs - totalExpenses,
    transactionCount: txns.length,
    uncategorizedCount,
  };
}

export const reportsRoute = new Hono<Env>()
  .get("/live", async (c) => {
    const userId = c.get("userId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (!startDate || !endDate) {
      return c.json({ error: "startDate and endDate required" }, 400);
    }

    const txns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, new Date(startDate)),
        lte(transactions.date, new Date(endDate))
      ),
      with: { category: true },
    });

    return c.json(buildPLData(txns, startDate, endDate));
  })

  .get("/export", async (c) => {
    const userId = c.get("userId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const format = c.req.query("format") ?? "xlsx";

    if (!startDate || !endDate) {
      return c.json({ error: "startDate and endDate required" }, 400);
    }

    const txns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, new Date(startDate)),
        lte(transactions.date, new Date(endDate))
      ),
      with: { category: true },
    });

    const data = buildPLData(txns, startDate, endDate);
    const fileName = `PL-${startDate}-to-${endDate}`;

    if (format === "csv") {
      const csv = generateCsv(data as unknown as Record<string, unknown>);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}.csv"`,
        },
      });
    }

    const buffer = await generateExcel(
      data as unknown as Record<string, unknown>
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      },
    });
  });
