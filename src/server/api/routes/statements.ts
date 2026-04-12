import { Hono } from "hono";
import { db } from "@/db";
import { statements, transactions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { saveFile, deleteFile } from "@/server/storage/local";
import { extractPagesFromPdf } from "@/lib/pdf";
import { extractTransactionsFromPages } from "@/server/ai/extract-transactions";
import { categorizeInMemory, createVendorRules } from "@/server/ai/categorize";

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

    // Process in background — don't block the response
    processStatement(userId, id, row.filePath).catch((err) => {
      console.error("[process] Background processing failed:", err);
    });

    return c.json({ success: true });
  });

async function processStatement(
  userId: string,
  statementId: string,
  filePath: string
) {
  async function setStep(step: string) {
    console.log(`[process] Step: ${step}`);
    await db
      .update(statements)
      .set({ processingStep: step })
      .where(eq(statements.id, statementId));
  }

  try {
    // Step 1: Read file
    await setStep("reading");
    const pages = await extractPagesFromPdf(filePath);
    console.log("[process] Found", pages.length, "pages with content");

    if (pages.length === 0) {
      throw new Error("No readable content found in PDF");
    }

    // Step 2: Extract transactions
    await setStep("extracting");
    const extracted = await extractTransactionsFromPages(pages);
    console.log("[process] Total extracted:", extracted.length, "transactions");

    if (extracted.length === 0) {
      throw new Error("No transactions found in statement");
    }

    // Step 3: Match vendors
    await setStep("matching");
    const inputs = extracted.map((t, i) => ({
      description: t.description,
      index: i,
    }));

    // Step 4: Categorize
    await setStep("categorizing");
    const categoryResults = await categorizeInMemory(userId, inputs);

    const catMap = new Map<number, { categoryId: string | null; vendorName: string | null }>();
    for (const r of categoryResults) {
      catMap.set(r.index, { categoryId: r.categoryId, vendorName: r.vendorName });
    }

    // Step 5: Save everything atomically
    await setStep("saving");
    extracted.sort((a, b) => a.date.getTime() - b.date.getTime());

    const txnRows = extracted.map((t, i) => {
      const cat = catMap.get(i);
      return {
        userId,
        statementId,
        date: t.date,
        description: t.description,
        amount: t.amount.toString(),
        type: t.type as "income" | "expense",
        rawText: t.rawText,
        categoryId: cat?.categoryId ?? null,
      };
    });

    const inserted = await db.insert(transactions).values(txnRows).returning();

    const vendorData = inserted.map((row, i) => ({
      id: row.id,
      description: row.description,
      categoryId: row.categoryId,
      vendorName: catMap.get(i)?.vendorName ?? null,
    }));
    await createVendorRules(userId, vendorData);

    // Done
    await db
      .update(statements)
      .set({
        status: "categorized",
        processingStep: null,
        transactionCount: extracted.length,
        periodStart: extracted[0].date,
        periodEnd: extracted[extracted.length - 1].date,
      })
      .where(eq(statements.id, statementId));

    console.log("[process] Done!", statementId, ":", extracted.length, "transactions");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    console.error("[process] Error:", message);

    await db
      .update(statements)
      .set({ status: "error", processingStep: null, errorMessage: message })
      .where(eq(statements.id, statementId));
  }
}
