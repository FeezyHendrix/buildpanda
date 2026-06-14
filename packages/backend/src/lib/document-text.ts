const MAX_PDF_PAGES = 30;

export interface ExtractedText {
  text: string;
  pageCount: number;
  truncated: boolean;
}

function detectKind(fileName: string): "pdf" | "xlsx" | "csv" | "docx" | "txt" | "unknown" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "txt";
  return "unknown";
}

async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pageCount = doc.numPages;
  const limit = Math.min(pageCount, MAX_PDF_PAGES);
  const parts: string[] = [];
  for (let p = 1; p <= limit; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return { text: parts.join("\n\n").trim(), pageCount, truncated: pageCount > limit };
}

async function extractXlsx(buffer: Buffer): Promise<ExtractedText> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]!);
    parts.push(`# ${name}\n${csv}`);
  }
  return { text: parts.join("\n\n").trim(), pageCount: wb.SheetNames.length, truncated: false };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedText> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value.trim(), pageCount: 1, truncated: false };
}

export function isTextExtractable(fileName: string): boolean {
  const kind = detectKind(fileName);
  return kind === "pdf" || kind === "xlsx" || kind === "csv" || kind === "docx" || kind === "txt";
}

export async function extractDocumentText(buffer: Buffer, fileName: string): Promise<ExtractedText> {
  const kind = detectKind(fileName);
  if (kind === "pdf") return extractPdf(buffer);
  if (kind === "xlsx") return extractXlsx(buffer);
  if (kind === "docx") return extractDocx(buffer);
  if (kind === "csv" || kind === "txt") {
    return { text: buffer.toString("utf8").trim(), pageCount: 1, truncated: false };
  }
  throw new Error(`Cannot extract text from "${fileName}". Supported: .pdf, .docx, .xlsx, .csv, .txt`);
}
