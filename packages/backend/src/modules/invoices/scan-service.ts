import type { Knex } from "knex";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { openStoredFile, streamToBuffer } from "../../lib/file-storage.ts";
import { renderPdfPagesToPng, pngToDataUrl } from "../../lib/document-render.ts";
import { chatJsonValidated, type LlmMessage } from "../../lib/llm.ts";
import { filesRepository } from "../files/repository.ts";
import { extractedInvoiceSchema, type ExtractedInvoice } from "./scan-schema.ts";

const MAX_PAGES = 3;

// The explicit shape skeleton is load-bearing: without it gpt-4o-mini invents
// nested {currency,amount} money objects on the first pass, failing validation
// and forcing a repair retry that both doubles token cost and drops fields.
const SYSTEM_PROMPT =
  "You transcribe an invoice or receipt into the exact JSON shape below. You are recording what the document already states — you are NOT authorising or computing any payment.\n" +
  "Rules: copy printed values verbatim; use null (not a guess) for anything not clearly shown; amounts are plain numbers (no currency objects, no strings); dates are YYYY-MM-DD; currency is a 3-letter ISO code or null; rates are percentages as numbers (7.5, not 0.075); negative signs on withholding are dropped (magnitude only); do not invent line items, totals, taxes, or parties.\n" +
  "Return ONLY this JSON shape, same keys, no extra keys:\n" +
  "{\n" +
  '  "documentKind": "invoice|receipt|quote|other", "confidence": "high|medium|low",\n' +
  '  "vendorName": string|null, "invoiceNumber": string|null, "issueDate": string|null, "dueDate": string|null, "currency": string|null,\n' +
  '  "lineItems": [{ "description": string, "quantity": number|null, "unit": string|null, "unitRate": number|null, "lineTotal": number|null }],\n' +
  '  "subtotal": number|null, "vatRate": number|null, "vatAmount": number|null, "whtRate": number|null, "retentionRate": number|null, "total": number|null,\n' +
  '  "fromParty": { "name": string|null, "address": string|null, "tin": string|null, "firsNumber": string|null, "email": string|null, "bank": { "accountName": string|null, "accountNumber": string|null, "bankName": string|null }|null }|null,\n' +
  '  "toParty": (same shape as fromParty)|null,\n' +
  '  "notes": string|null\n' +
  "}";

export interface InvoiceScanResult {
  draft: ExtractedInvoice;
  sourceFileId: string;
  retryCount: number;
}

function isImageMime(mime: string | null, fileName: string): boolean {
  if (mime && /^image\//i.test(mime)) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
}

function isPdf(mime: string | null, fileName: string): boolean {
  if (mime && /pdf/i.test(mime)) return true;
  return /\.pdf$/i.test(fileName);
}

export function invoicesScanService(db: Knex) {
  const files = filesRepository(db);

  return {
    async scanUploadedFile(projectId: string, fileId: string): Promise<InvoiceScanResult> {
      const file = await files.findById(fileId);
      if (!file) throw new NotFoundError("File");
      if (file.project_id !== projectId) {
        throw new BadRequestError("This file does not belong to the project");
      }
      if (!file.storage_path) {
        throw new BadRequestError("This file has no stored content to scan");
      }

      const pdf = isPdf(file.mime_type, file.file_name);
      const image = isImageMime(file.mime_type, file.file_name);
      if (!pdf && !image) {
        throw new BadRequestError("Invoice scan supports PDF and image files (.pdf, .png, .jpg)");
      }

      const buffer = await streamToBuffer(await openStoredFile(file.storage_path));

      let images: string[];
      if (pdf) {
        const pages = await renderPdfPagesToPng(buffer, { maxPages: MAX_PAGES });
        if (pages.length === 0) {
          throw new BadRequestError("Could not read this document. Try a clearer PDF or image.");
        }
        images = pages.map((p) => pngToDataUrl(p));
      } else {
        const mime = file.mime_type ?? "image/png";
        images = [`data:${mime};base64,${buffer.toString("base64")}`];
      }

      const messages: LlmMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this invoice/receipt document into the required JSON. Only include what the document shows.",
            },
            ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
          ],
        },
      ];

      const result = await chatJsonValidated(messages, extractedInvoiceSchema);
      if (!result) {
        throw new BadRequestError("Invoice scanning is not configured on this environment");
      }

      return { draft: result.data, sourceFileId: fileId, retryCount: result.retryCount };
    },
  };
}
