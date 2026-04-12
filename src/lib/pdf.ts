import { readFile } from "fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export async function extractPagesFromPdf(filePath: string): Promise<PdfPage[]> {
  const buffer = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const pages: PdfPage[] = [];
  const textArray = Array.isArray(text) ? text : [text];

  for (let i = 0; i < totalPages; i++) {
    const pageText = textArray[i] ?? "";
    // Only include pages with meaningful content (not just headers/footers)
    if (pageText.trim().length > 50) {
      pages.push({ pageNumber: i + 1, text: pageText });
    }
  }

  return pages;
}

export async function readPdfAsBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString("base64");
}
