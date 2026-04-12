import { callOpenAI } from "./providers";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import type { PdfPage } from "@/lib/pdf";

export interface ExtractedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: "income" | "expense";
  rawText: string;
}

const MAX_RETRIES = 2;
const MAX_CONCURRENT = 3;

// Process pages in parallel (max 3 concurrent) with retry
export async function extractTransactionsFromPages(
  pages: PdfPage[]
): Promise<ExtractedTransaction[]> {
  const results: ExtractedTransaction[][] = new Array(pages.length);

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < pages.length; i += MAX_CONCURRENT) {
    const batch = pages.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map(async (page, batchIdx) => {
      const pageIdx = i + batchIdx;
      console.log(
        `[extract] Processing page ${page.pageNumber} (${page.text.length} chars)`
      );
      results[pageIdx] = await extractPageWithRetry(page);
      console.log(
        `[extract] Page ${page.pageNumber}: ${results[pageIdx].length} transactions`
      );
    });
    await Promise.all(promises);
  }

  return results.flat();
}

async function extractPageWithRetry(
  page: PdfPage
): Promise<ExtractedTransaction[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callOpenAI(
        [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract transactions from this bank statement page:\n\n${page.text}`,
          },
        ],
        { maxTokens: 4096 }
      );

      return parseExtractionResponse(text);
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `[extract] Page ${page.pageNumber} failed after ${MAX_RETRIES + 1} attempts:`,
          err
        );
        throw err;
      }
      console.warn(
        `[extract] Page ${page.pageNumber} attempt ${attempt + 1} failed, retrying...`
      );
    }
  }

  return [];
}

function parseExtractionResponse(text: string): ExtractedTransaction[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  if (!cleaned || cleaned === "[]" || cleaned === '{"transactions":[]}')
    return [];

  const parsed = JSON.parse(cleaned);
  const items = Array.isArray(parsed) ? parsed : parsed.transactions ?? [];

  return items.map(
    (item: {
      date: string;
      description: string;
      amount: number | string;
      type: string;
    }) => ({
      date: new Date(item.date),
      description: item.description,
      amount: Math.abs(
        typeof item.amount === "string"
          ? parseFloat(item.amount)
          : item.amount
      ),
      type: item.type === "income" ? "income" : "expense",
      rawText: "",
    })
  );
}
