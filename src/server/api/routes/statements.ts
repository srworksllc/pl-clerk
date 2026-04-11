import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { statements, transactions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { saveFile, deleteFile } from "@/server/storage/local";
import { extractTextFromPdf } from "@/lib/pdf";
import { extractTransactions } from "@/server/ai/extract-transactions";
import { categorizeTransactions } from "@/server/ai/categorize";

type Env = { Variables: { userId: string } };

export const statementsRoute = new Hono<Env>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await db.query.statements.findMany({
      where: eq(statements.userId, userId),
      orderBy: desc(statements.createdAt),
    });
    return c.json(rows);
  })

  .post("/upload", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveFile(userId, file.name, buffer);

    const [row] = await db
      .insert(statements)
      .values({
        userId,
        fileName: file.name,
        filePath,
        fileSize: buffer.length,
        status: "uploaded",
      })
      .returning();

    return c.json(row, 201);
  })

  .get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row = await db.query.statements.findFirst({
      where: and(eq(statements.id, id), eq(statements.userId, userId)),
    });

    if (!row) return c.json({ error: "Not found" }, 404);

    const txns = await db.query.transactions.findMany({
      where: eq(transactions.statementId, id),
      with: { category: true, vendor: true },
      orderBy: desc(transactions.date),
    });

    return c.json({ ...row, transactions: txns });
  })

  .delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row = await db.query.statements.findFirst({
      where: and(eq(statements.id, id), eq(statements.userId, userId)),
    });

    if (!row) return c.json({ error: "Not found" }, 404);

    await deleteFile(row.filePath);
    await db
      .delete(statements)
      .where(and(eq(statements.id, id), eq(statements.userId, userId)));

    return c.json({ success: true });
  })

  .post("/:id/process", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row = await db.query.statements.findFirst({
      where: and(eq(statements.id, id), eq(statements.userId, userId)),
    });

    if (!row) return c.json({ error: "Not found" }, 404);

    await db
      .update(statements)
      .set({ status: "processing" })
      .where(eq(statements.id, id));

    try {
      const pdfText = await extractTextFromPdf(row.filePath);
      const extracted = await extractTransactions(pdfText);

      await db
        .update(statements)
        .set({
          status: "extracted",
          transactionCount: extracted.length,
          periodStart: extracted.length > 0 ? extracted[0].date : null,
          periodEnd:
            extracted.length > 0
              ? extracted[extracted.length - 1].date
              : null,
        })
        .where(eq(statements.id, id));

      const txnRows = extracted.map((t) => ({
        userId,
        statementId: id,
        date: t.date,
        description: t.description,
        amount: t.amount.toString(),
        type: t.type as "income" | "expense",
        rawText: t.rawText,
      }));

      if (txnRows.length > 0) {
        await db.insert(transactions).values(txnRows);
      }

      const insertedTxns = await db.query.transactions.findMany({
        where: eq(transactions.statementId, id),
      });

      await categorizeTransactions(userId, insertedTxns);

      await db
        .update(statements)
        .set({ status: "categorized" })
        .where(eq(statements.id, id));

      return c.json({ success: true, transactionCount: extracted.length });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Processing failed";
      await db
        .update(statements)
        .set({ status: "error", errorMessage: message })
        .where(eq(statements.id, id));
      return c.json({ error: message }, 500);
    }
  });
