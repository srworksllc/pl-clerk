import { anthropic, openai } from "./providers";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";

interface ExtractedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: "income" | "expense";
  rawText: string;
}

export async function extractTransactions(
  pdfText: string
): Promise<ExtractedTransaction[]> {
  try {
    return await extractWithClaude(pdfText);
  } catch {
    return await extractWithOpenAI(pdfText);
  }
}

async function extractWithClaude(
  pdfText: string
): Promise<ExtractedTransaction[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract all transactions from this bank statement:\n\n${pdfText}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return parseExtractionResponse(text);
}

async function extractWithOpenAI(
  pdfText: string
): Promise<ExtractedTransaction[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract all transactions from this bank statement:\n\n${pdfText}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "[]";
  return parseExtractionResponse(text);
}

function parseExtractionResponse(text: string): ExtractedTransaction[] {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const items = Array.isArray(parsed) ? parsed : parsed.transactions ?? [];

  return items.map(
    (item: {
      date: string;
      description: string;
      amount: number | string;
      type: string;
      rawText?: string;
      raw_text?: string;
    }) => ({
      date: new Date(item.date),
      description: item.description,
      amount: Math.abs(
        typeof item.amount === "string"
          ? parseFloat(item.amount)
          : item.amount
      ),
      type: item.type === "income" ? "income" : "expense",
      rawText: item.rawText ?? item.raw_text ?? "",
    })
  );
}
