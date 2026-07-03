import PDFDocument from "pdfkit";
import { COLOR, FONT, PAGE_MARGIN, registerReportFonts, type ReportDoc } from "../../lib/report-theme.ts";
import type { Invoice } from "./types.ts";
import type { InvoiceOrganizationRow } from "./repository.ts";

type Doc = ReportDoc;

const BOTTOM_MARGIN = PAGE_MARGIN + 24;

function text(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function money(currency: string, value: number): string {
  return `${currency} ${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function bankDetails(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const pairs = [
    ["Bank", record.bankName ?? record.bank_name],
    ["Account name", record.accountName ?? record.account_name],
    ["Account no.", record.accountNumber ?? record.account_number],
  ] as const;
  return pairs
    .filter(([, entry]) => typeof entry === "string" && entry.trim().length > 0)
    .map(([label, entry]) => `${label}: ${entry as string}`);
}

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - BOTTOM_MARGIN) doc.addPage();
}

function section(doc: Doc, label: string): void {
  ensureSpace(doc, 34);
  doc.moveDown(0.9);
  doc.font(FONT.semibold).fontSize(8).fillColor(COLOR.muted).text(label.toUpperCase(), PAGE_MARGIN, doc.y, {
    characterSpacing: 1.2,
  });
  doc.moveDown(0.35);
}

function rule(doc: Doc, y = doc.y): void {
  doc.moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).lineWidth(0.75).strokeColor(COLOR.hairline).stroke();
}

function drawWrapped(doc: Doc, value: string | null | undefined, x: number, y: number, width: number): number {
  doc.font(FONT.regular).fontSize(9).fillColor(COLOR.body).text(text(value), x, y, { width, lineGap: 2 });
  return doc.y;
}

function partyBlock(doc: Doc, title: string, party: Invoice["toParty"], x: number, y: number, width: number): number {
  doc.font(FONT.semibold).fontSize(8).fillColor(COLOR.muted).text(title.toUpperCase(), x, y, { width });
  let nextY = doc.y + 6;
  doc.font(FONT.semibold).fontSize(11).fillColor(COLOR.ink).text(text(party?.name), x, nextY, { width });
  nextY = doc.y + 4;
  nextY = drawWrapped(doc, party?.address, x, nextY, width) + 4;
  const details = [
    party?.tin ? `TIN: ${party.tin}` : null,
    party?.firsNumber ? `FIRS: ${party.firsNumber}` : null,
    party?.email ? `Email: ${party.email}` : null,
  ].filter((item): item is string => Boolean(item));
  if (details.length > 0) {
    doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.body).text(details.join("\n"), x, nextY, { width, lineGap: 2 });
    nextY = doc.y;
  }
  return nextY;
}

function masthead(doc: Doc, invoice: Invoice, org: InvoiceOrganizationRow | null): void {
  const rightX = doc.page.width - PAGE_MARGIN - 220;
  doc.font(FONT.bold).fontSize(18).fillColor(COLOR.ink).text(text(org?.name), PAGE_MARGIN, PAGE_MARGIN, { width: 270 });
  const orgLines = [org?.address, org?.phone, org?.tin ? `TIN: ${org.tin}` : null, org?.firs_number ? `FIRS: ${org.firs_number}` : null]
    .filter((item): item is string => Boolean(item));
  doc.moveDown(0.35);
  doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.body).text(orgLines.join("\n"), PAGE_MARGIN, doc.y, { width: 300, lineGap: 2 });

  doc.font(FONT.bold).fontSize(23).fillColor(COLOR.brand).text("INVOICE", rightX, PAGE_MARGIN, { width: 220, align: "right" });
  doc.font(FONT.medium).fontSize(10).fillColor(COLOR.ink).text(text(invoice.number), rightX, doc.y + 4, { width: 220, align: "right" });
  doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.body).text(invoice.invoiceType.toUpperCase(), rightX, doc.y + 4, { width: 220, align: "right" });
  doc.y = Math.max(doc.y + 12, 136);
  rule(doc);
}

function metaRow(doc: Doc, label: string, value: string, x: number, y: number, width: number): number {
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.muted).text(label, x, y, { width: 86, continued: false });
  doc.font(FONT.semibold).fontSize(9).fillColor(COLOR.ink).text(value, x + 88, y, { width: width - 88, align: "right" });
  return Math.max(doc.y, y + 14);
}

function invoiceMeta(doc: Doc, invoice: Invoice): void {
  const x = doc.page.width - PAGE_MARGIN - 220;
  let y = doc.y + 14;
  y = metaRow(doc, "Issue date", dateLabel(invoice.issueDate), x, y, 220);
  y = metaRow(doc, "Due date", dateLabel(invoice.dueDate), x, y + 3, 220);
  y = metaRow(doc, "Currency", invoice.currency, x, y + 3, 220);
  y = metaRow(doc, "Status", invoice.status, x, y + 3, 220);
  if (invoice.contractReference) y = metaRow(doc, "Contract", invoice.contractReference, x, y + 3, 220);
  doc.y = Math.max(doc.y, y);
}

function parties(doc: Doc, invoice: Invoice): void {
  const y = doc.y + 16;
  const width = (doc.page.width - PAGE_MARGIN * 2 - 28) / 2;
  const toY = partyBlock(doc, "Bill to", invoice.toParty, PAGE_MARGIN, y, width);
  const fromY = partyBlock(doc, "From", invoice.fromParty, PAGE_MARGIN + width + 28, y, width);
  doc.y = Math.max(toY, fromY) + 6;
}

function tableHeader(doc: Doc, y: number): void {
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 24, 6).fill(COLOR.panel);
  doc.font(FONT.semibold).fontSize(8).fillColor(COLOR.muted);
  const columns = [
    ["Description", PAGE_MARGIN + 12, 230, "left"],
    ["Qty", PAGE_MARGIN + 250, 52, "right"],
    ["Unit", PAGE_MARGIN + 310, 50, "left"],
    ["Rate", PAGE_MARGIN + 365, 72, "right"],
    ["Amount", PAGE_MARGIN + 444, 78, "right"],
  ] as const;
  for (const [label, x, width, align] of columns) doc.text(label, x, y + 8, { width, align });
}

function lineItems(doc: Doc, invoice: Invoice): void {
  section(doc, "Line items");
  tableHeader(doc, doc.y);
  doc.y += 30;
  for (const item of invoice.lineItems) {
    ensureSpace(doc, 42);
    const y = doc.y;
    const descriptionHeight = doc.heightOfString(item.description, { width: 230, lineGap: 2 });
    const rowHeight = Math.max(26, descriptionHeight + 10);
    doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.ink).text(item.description, PAGE_MARGIN + 12, y + 5, { width: 230, lineGap: 2 });
    doc.text(new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(item.quantity), PAGE_MARGIN + 250, y + 5, { width: 52, align: "right" });
    doc.text(text(item.unit), PAGE_MARGIN + 310, y + 5, { width: 50 });
    doc.text(money(invoice.currency, item.unitRate), PAGE_MARGIN + 365, y + 5, { width: 72, align: "right" });
    doc.font(FONT.medium).text(money(invoice.currency, item.amount), PAGE_MARGIN + 444, y + 5, { width: 78, align: "right" });
    rule(doc, y + rowHeight);
    doc.y = y + rowHeight + 6;
  }
}

function totals(doc: Doc, invoice: Invoice): void {
  const x = doc.page.width - PAGE_MARGIN - 250;
  let y = doc.y + 10;
  const rows = [
    ["Subtotal", money(invoice.currency, invoice.subtotal), false],
    [`VAT (${invoice.vatRate}%)`, money(invoice.currency, invoice.vatAmount), false],
    [`WHT deduction (${invoice.whtRate}%)`, `- ${money(invoice.currency, invoice.whtAmount)}`, false],
    [`Retention held (${invoice.retentionRate}%)`, `- ${money(invoice.currency, invoice.retentionAmount)}`, false],
    ["Total invoiced", money(invoice.currency, invoice.totalInvoiced), false],
    ["NET PAYABLE", money(invoice.currency, invoice.netPayable), true],
    ["Amount paid", money(invoice.currency, invoice.amountPaid), false],
    ["Balance due", money(invoice.currency, invoice.balanceDue), true],
  ] as const;
  for (const [label, value, strong] of rows) {
    ensureSpace(doc, 22);
    doc.font(strong ? FONT.bold : FONT.regular).fontSize(strong ? 10 : 9).fillColor(strong ? COLOR.ink : COLOR.body).text(label, x, y, { width: 125 });
    doc.font(strong ? FONT.bold : FONT.semibold).fillColor(strong ? COLOR.brand : COLOR.ink).text(value, x + 126, y, { width: 124, align: "right" });
    y = doc.y + 6;
    if (strong) rule(doc, y - 2);
  }
  doc.y = y;
}

function notes(doc: Doc, invoice: Invoice, org: InvoiceOrganizationRow | null): void {
  const blocks = [
    ["Payment details", invoice.paymentInstructions],
    ["Bank details", [...bankDetails(org?.bank_details), ...(invoice.fromParty?.bank ? bankDetails(invoice.fromParty.bank) : [])].join("\n")],
    ["Payment terms", invoice.paymentTerms],
    ["Cover note", invoice.coverNote],
    ["Header note", invoice.headerText],
    ["Footer note", invoice.footerText],
  ] as const;
  for (const [label, value] of blocks) {
    if (!value) continue;
    section(doc, label);
    drawWrapped(doc, value, PAGE_MARGIN, doc.y, doc.page.width - PAGE_MARGIN * 2);
  }
}

function footer(doc: Doc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - PAGE_MARGIN;
    rule(doc, y - 8);
    doc.font(FONT.regular).fontSize(7.5).fillColor(COLOR.muted).text("Generated by BuildPanda", PAGE_MARGIN, y, { width: 220 });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 120, y, { width: 120, align: "right" });
  }
}

export function renderInvoicePdf(invoice: Invoice, org: InvoiceOrganizationRow | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Invoice ${invoice.number ?? invoice.id}`,
        Author: org?.name ?? "BuildPanda",
        Creator: "BuildPanda",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      registerReportFonts(doc);
      doc.font(FONT.regular);
      masthead(doc, invoice, org);
      invoiceMeta(doc, invoice);
      parties(doc, invoice);
      lineItems(doc, invoice);
      totals(doc, invoice);
      notes(doc, invoice, org);
      footer(doc);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
