import { readFile } from "fs/promises";

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}
