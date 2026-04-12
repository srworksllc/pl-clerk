import { callOpenAI } from "./providers";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import type { PdfPage } from "@/lib/pdf";

interface ExtractedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: "income" | "expense";
  rawText: string;
}

export async function extractTransactionsFromPages(
  pages: PdfPage[]
): Promise<ExtractedTransaction[]> {
  const allTransactions: ExtractedTransaction[] = [];

  for (const page of pages) {
    console.log(`[extract] Processing page ${page.pageNumber} (${page.text.length} chars)`);

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

    const parsed = parseExtractionResponse(text);
    console.log(`[extract] Page ${page.pageNumber}: ${parsed.length} transactions`);
    allTransactions.push(...parsed);
  }

  return allTransactions;
}

function parseExtractionResponse(text: string): ExtractedTransaction[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  if (!cleaned || cleaned === "[]") return [];

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
