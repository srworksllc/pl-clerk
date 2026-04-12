import { Hono } from "hono";
import { categorizeTransactions } from "@/server/ai/categorize";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

type Env = { Variables: { userId: string } };

export const aiRoute = new Hono<Env>()
  .post("/categorize", async (c) => {
    const userId = c.get("userId");
    const { statementId } = await c.req.json<{ statementId: string }>();

    const txns = await db.query.transactions.findMany({
      where: eq(transactions.statementId, statementId),
    });

    await categorizeTransactions(userId, txns);

    return c.json({ success: true, count: txns.length });
  });
