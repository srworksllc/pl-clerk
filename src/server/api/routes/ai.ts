import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { extractTransactions } from "@/server/ai/extract-transactions";
import { categorizeTransactions } from "@/server/ai/categorize";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

type Env = { Variables: { userId: string } };

export const aiRoute = new Hono<Env>()
  .post(
    "/extract",
    zValidator(
      "json",
      z.object({
        text: z.string().min(1),
      })
    ),
    async (c) => {
      const { text } = c.req.valid("json");
      const result = await extractTransactions(text);
      return c.json(result);
    }
  )

  .post(
    "/categorize",
    zValidator(
      "json",
      z.object({
        statementId: z.string(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const { statementId } = c.req.valid("json");

      const txns = await db.query.transactions.findMany({
        where: eq(transactions.statementId, statementId),
      });

      await categorizeTransactions(userId, txns);

      return c.json({ success: true, count: txns.length });
    }
  );
