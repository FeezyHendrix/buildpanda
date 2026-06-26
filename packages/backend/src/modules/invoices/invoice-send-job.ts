import { Readable } from "node:stream";
import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { config } from "../../config/index.ts";
import { renderEmail, calloutBox, infoRow, metaTable } from "../../lib/email-templates.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { logger } from "../../lib/logger.ts";
import { sendEmail } from "../../lib/mail.ts";
import { invoicesRepository } from "./repository.ts";
import { invoicesService } from "./service.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";

export const INVOICE_EMAIL_QUEUE = "invoice-email";

export interface InvoiceEmailJobData {
  invoiceId: string;
  recipientEmail: string;
  cc: string[];
  bcc: string[];
  coverNote: string | null;
  headerText: string | null;
  footerText: string | null;
}

function publicInvoiceUrl(token: string): string {
  const base = config.mail.appUrl.replace(/\/+$/, "");
  return `${base}/public/invoices/${token}`;
}

function invoiceSubject(invoiceNumber: string | null): string {
  return invoiceNumber ? `Invoice ${invoiceNumber} from BuildPanda` : "Invoice from BuildPanda";
}

async function storePdf(service: ReturnType<typeof invoicesService>, invoiceId: string, pdf: Buffer): Promise<string | null> {
  try {
    const stored = await saveStream(invoiceId, Readable.from(pdf));
    await service.savePdfStorageKey(invoiceId, stored.storagePath);
    return stored.storagePath;
  } catch (error) {
    logger.warn({ err: error, invoiceId }, "[invoice-email] PDF storage failed; sending generated attachment only");
    return null;
  }
}

export async function runInvoiceEmail(db: Knex, data: InvoiceEmailJobData): Promise<void> {
  const repository = invoicesRepository(db);
  const service = invoicesService(repository);
  const row = await repository.findById(data.invoiceId);
  if (!row) {
    logger.warn({ invoiceId: data.invoiceId }, "[invoice-email] invoice not found");
    return;
  }

  const [invoice, org] = await Promise.all([
    service.get(row.project_id, row.id),
    repository.organizationForProject(row.project_id),
  ]);
  const pdf = await renderInvoicePdf(invoice, org ?? null);
  await storePdf(service, invoice.id, pdf);

  const token = invoice.publicToken;
  const link = token ? publicInvoiceUrl(token) : config.mail.appUrl;
  const bodyRows = metaTable(
    infoRow("Invoice", invoice.number ?? invoice.id) +
      infoRow("Amount due", `${invoice.currency} ${invoice.balanceDue.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) +
      infoRow("Due date", invoice.dueDate ?? "Not specified"),
  );
  const note = data.coverNote ? calloutBox(data.coverNote, "brand") : "";
  const html = renderEmail({
    preview: `Invoice ${invoice.number ?? invoice.id} is ready for review.`,
    eyebrow: "Invoice",
    heading: `Invoice ${invoice.number ?? invoice.id}`,
    bodyHtml: `${note}${bodyRows}<p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:#414141;">Please find the invoice attached as a PDF. You can also view it securely using the link below.</p>`,
    cta: { label: "View invoice", url: link },
    footnote: org?.name ? `Sent by ${org.name} via BuildPanda.` : "Sent via BuildPanda.",
  });

  await sendEmail({
    to: data.recipientEmail,
    cc: data.cc,
    bcc: data.bcc,
    subject: invoiceSubject(invoice.number),
    html,
    attachments: [{ content: pdf, name: `invoice-${invoice.number ?? invoice.id}.pdf`, mimeType: "application/pdf" }],
  });
}

export function registerInvoiceEmailWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<InvoiceEmailJobData>(INVOICE_EMAIL_QUEUE, (jobData) => runInvoiceEmail(db, jobData));
}
