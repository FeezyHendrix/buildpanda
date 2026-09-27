import PDFDocument from "pdfkit";
import {
  COLOR,
  FONT,
  PAGE_MARGIN,
  registerReportFonts,
  type ReportDoc,
} from "../../lib/report-theme.ts";
import type { InvoiceOrganizationRow } from "./repository.ts";
import type { Invoice, PayApplicationSummary } from "./types.ts";

type Doc = ReportDoc;

const BOTTOM_MARGIN = PAGE_MARGIN + 24;

function text(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function money(currency: string, value: number): string {
  return `${currency} ${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

interface Column {
  label: string;
  width: number;
  align: "left" | "right";
}

// AIA G703 continuation-sheet columns (ernest ScheduleOfValues / PayApplication):
// scheduled value, work billed prior + this period, stored materials, total
// completed & stored, % complete, balance to finish, retainage.
const COLUMNS: Column[] = [
  { label: "Stage", width: 146, align: "left" },
  { label: "Scheduled value", width: 88, align: "right" },
  { label: "Prior billed", width: 76, align: "right" },
  { label: "This period", width: 76, align: "right" },
  { label: "Stored materials", width: 78, align: "right" },
  { label: "Completed & stored", width: 86, align: "right" },
  { label: "%", width: 38, align: "right" },
  { label: "Balance to finish", width: 82, align: "right" },
  { label: "Retained", width: 72, align: "right" },
];

function tableWidth(): number {
  return COLUMNS.reduce((sum, col) => sum + col.width, 0);
}

function columnX(index: number): number {
  let x = PAGE_MARGIN;
  for (let i = 0; i < index; i += 1) x += COLUMNS[i]?.width ?? 0;
  return x;
}

function rule(doc: Doc, y = doc.y): void {
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .lineWidth(0.75)
    .strokeColor(COLOR.hairline)
    .stroke();
}

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - BOTTOM_MARGIN) doc.addPage();
}

function section(doc: Doc, label: string): void {
  ensureSpace(doc, 30);
  doc.moveDown(0.6);
  doc
    .font(FONT.semibold)
    .fontSize(8)
    .fillColor(COLOR.muted)
    .text(label.toUpperCase(), PAGE_MARGIN, doc.y, { characterSpacing: 1 });
  doc.moveDown(0.3);
}

function masthead(doc: Doc, invoice: Invoice, org: InvoiceOrganizationRow | null): void {
  doc
    .font(FONT.bold)
    .fontSize(16)
    .fillColor(COLOR.ink)
    .text(text(org?.name), PAGE_MARGIN, PAGE_MARGIN, { width: 360 });
  const orgLines = [org?.address, org?.phone].filter((line): line is string =>
    Boolean(line),
  );
  doc.moveDown(0.3);
  doc
    .font(FONT.regular)
    .fontSize(8.5)
    .fillColor(COLOR.body)
    .text(orgLines.join("\n"), PAGE_MARGIN, doc.y, { width: 360, lineGap: 2 });

  const rightX = doc.page.width - PAGE_MARGIN - 240;
  doc
    .font(FONT.bold)
    .fontSize(19)
    .fillColor(COLOR.brand)
    .text("PAYMENT APPLICATION", rightX, PAGE_MARGIN, { width: 240, align: "right" });
  doc
    .font(FONT.medium)
    .fontSize(10)
    .fillColor(COLOR.ink)
    .text(text(invoice.number), rightX, doc.y + 4, { width: 240, align: "right" });
  doc.y = Math.max(doc.y + 10, PAGE_MARGIN + 58);
  rule(doc);
}

function meta(doc: Doc, invoice: Invoice): void {
  const y = doc.y + 10;
  const items: [string, string][] = [
    ["Issue date", dateLabel(invoice.issueDate)],
    ["Due date", dateLabel(invoice.dueDate)],
    ["Currency", invoice.currency],
    ["Status", invoice.status],
  ];
  let x = PAGE_MARGIN;
  for (const [label, value] of items) {
    doc.font(FONT.regular).fontSize(8).fillColor(COLOR.muted).text(label, x, y);
    doc
      .font(FONT.semibold)
      .fontSize(9.5)
      .fillColor(COLOR.ink)
      .text(value, x, y + 11, { width: 160 });
    x += 170;
  }
  doc.y = y + 32;
}

function tableHeader(doc: Doc): void {
  const y = doc.y;
  doc.roundedRect(PAGE_MARGIN, y, tableWidth(), 22, 4).fill(COLOR.panel);
  doc.font(FONT.semibold).fontSize(7).fillColor(COLOR.muted);
  COLUMNS.forEach((col, index) => {
    doc.text(col.label.toUpperCase(), columnX(index) + 4, y + 7, {
      width: col.width - 8,
      align: col.align,
      characterSpacing: 0.3,
    });
  });
  doc.y = y + 26;
}

function payRow(doc: Doc, cells: string[], strong = false): void {
  if (doc.y + 20 > doc.page.height - BOTTOM_MARGIN) {
    doc.addPage();
    tableHeader(doc);
  }
  const y = doc.y;
  doc
    .font(strong ? FONT.semibold : FONT.regular)
    .fontSize(8)
    .fillColor(strong ? COLOR.ink : COLOR.body);
  COLUMNS.forEach((col, index) => {
    doc.text(cells[index] ?? "", columnX(index) + 4, y + 4, {
      width: col.width - 8,
      align: col.align,
    });
  });
  rule(doc, y + 18);
  doc.y = y + 22;
}

function scheduleTable(doc: Doc, invoice: Invoice, summary: PayApplicationSummary): void {
  section(doc, "Schedule of values");
  tableHeader(doc);
  const c = invoice.currency;
  for (const line of summary.lines) {
    payRow(doc, [
      line.stageName || "—",
      money(c, line.scheduledValue),
      money(c, line.priorBilled),
      money(c, line.thisPeriod),
      money(c, line.storedMaterials),
      money(c, line.totalCompleted),
      `${line.percentComplete}%`,
      money(c, line.balanceToFinish),
      money(c, line.retained),
    ]);
  }
  payRow(
    doc,
    [
      "TOTAL",
      money(c, summary.scheduledTotal),
      money(c, summary.priorBilledTotal),
      money(c, summary.thisPeriodTotal),
      money(c, summary.storedMaterialsTotal),
      money(c, summary.totalCompleted),
      "",
      money(c, summary.balanceToFinish),
      money(c, summary.retainedTotal),
    ],
    true,
  );
}

function summaryBlock(doc: Doc, invoice: Invoice, summary: PayApplicationSummary): void {
  section(doc, "Application summary");
  const c = invoice.currency;
  const rows: [string, string, boolean][] = [
    ["Scheduled value", money(c, summary.scheduledTotal), false],
    ["Total completed & stored to date", money(c, summary.totalCompleted), false],
    ["Retention held", `- ${money(c, summary.retainedTotal)}`, false],
    ["Less billed in previous applications", `- ${money(c, summary.priorBilledTotal)}`, false],
    ["CURRENT PAYMENT DUE", money(c, summary.currentPaymentDue), true],
    ["Balance to finish", money(c, summary.balanceToFinish), false],
  ];
  const x = doc.page.width - PAGE_MARGIN - 300;
  let y = doc.y + 6;
  for (const [label, value, strong] of rows) {
    ensureSpace(doc, 20);
    doc
      .font(strong ? FONT.bold : FONT.regular)
      .fontSize(strong ? 10 : 9)
      .fillColor(strong ? COLOR.ink : COLOR.body)
      .text(label, x, y, { width: 190 });
    doc
      .font(strong ? FONT.bold : FONT.semibold)
      .fillColor(strong ? COLOR.brand : COLOR.ink)
      .text(value, x + 192, y, { width: 108, align: "right" });
    y = doc.y + 6;
    if (strong) rule(doc, y - 2);
  }
  doc.y = y;
}

function footer(doc: Doc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - PAGE_MARGIN;
    rule(doc, y - 8);
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLOR.muted)
      .text("Generated by BuildPanda · recorded, not transacted", PAGE_MARGIN, y, {
        width: 340,
      });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 120, y, {
      width: 120,
      align: "right",
    });
  }
}

export function renderPayApplicationPdf(
  invoice: Invoice,
  summary: PayApplicationSummary,
  org: InvoiceOrganizationRow | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc: Doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Payment Application ${invoice.number ?? invoice.id}`,
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
      meta(doc, invoice);
      scheduleTable(doc, invoice, summary);
      summaryBlock(doc, invoice, summary);
      footer(doc);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
