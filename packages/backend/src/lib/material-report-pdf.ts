import PDFDocument from "pdfkit";
import { emailLogoPng } from "./email-assets.ts";
import {
  COLOR,
  FONT,
  PAGE_MARGIN,
  RULE_GAP,
  registerReportFonts,
  reportBottomLimit,
  reportInnerWidth,
  type ReportDoc,
} from "./report-theme.ts";
import { renderRichText, type RichTextOptions } from "./report-richtext.ts";

export interface MaterialReportStock {
  material: string;
  unit: string;
  onHand: string;
  lowStock: boolean;
}

export interface MaterialReportEntry {
  type: string;
  material: string;
  quantity: string;
  unit: string;
  occurredAt: string;
  loggedBy: string | null;
  reason: string | null;
  notesHtml: string | null;
  voided: boolean;
}

export interface MaterialReportPdfData {
  companyName: string;
  projectName: string;
  projectAddress?: string | null;
  reportDateLabel: string;
  generatedAtLabel: string;
  stock: MaterialReportStock[];
  entries: MaterialReportEntry[];
}

export interface MaterialReportPdfDeps {
  resolveImage: RichTextOptions["resolveImage"];
}

type Doc = ReportDoc;
const innerWidth = reportInnerWidth;
const bottomLimit = reportBottomLimit;

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > bottomLimit(doc)) doc.addPage();
}

function sectionLabel(doc: Doc, text: string): void {
  ensureSpace(doc, 34);
  doc
    .font(FONT.semibold)
    .fontSize(8)
    .fillColor(COLOR.muted)
    .text(text.toUpperCase(), PAGE_MARGIN, doc.y, { characterSpacing: 1.1 });
  doc.moveDown(0.45);
}

function masthead(doc: Doc, data: MaterialReportPdfData): void {
  doc.image(emailLogoPng, PAGE_MARGIN, PAGE_MARGIN, { width: 104 });
  doc
    .font(FONT.semibold)
    .fontSize(13)
    .fillColor(COLOR.ink)
    .text("Material Report", PAGE_MARGIN, PAGE_MARGIN + 6, {
      width: innerWidth(doc),
      align: "right",
    });
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(COLOR.muted)
    .text(data.reportDateLabel, { width: innerWidth(doc), align: "right" });
  doc.y = PAGE_MARGIN + 46;
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .lineWidth(0.75)
    .strokeColor(COLOR.hairline)
    .stroke();
  doc.y += RULE_GAP;
}

function identityBlock(doc: Doc, data: MaterialReportPdfData): void {
  doc.font(FONT.bold).fontSize(14).fillColor(COLOR.ink).text(data.projectName, PAGE_MARGIN, doc.y, {
    width: innerWidth(doc),
  });
  const meta = [data.companyName, data.projectAddress ?? undefined].filter(Boolean).join("   •   ");
  if (meta) {
    doc.moveDown(0.25);
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text(meta, { width: innerWidth(doc) });
  }
  doc.y += RULE_GAP + 4;
}

function stockTable(doc: Doc, stock: MaterialReportStock[]): void {
  sectionLabel(doc, `Stock on hand${stock.length ? `  (${stock.length})` : ""}`);
  const width = innerWidth(doc);
  if (stock.length === 0) {
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text("No stock recorded.", PAGE_MARGIN, doc.y, { width });
    doc.y += RULE_GAP;
    return;
  }
  const padX = 8;
  const nameW = width * 0.6;
  const qtyW = width * 0.4;

  const top = doc.y;
  doc.font(FONT.semibold).fontSize(7.5).fillColor(COLOR.muted);
  doc.text("MATERIAL", PAGE_MARGIN + padX, top + 7, { width: nameW - padX, characterSpacing: 0.5 });
  doc.text("ON HAND", PAGE_MARGIN + nameW, top + 7, { width: qtyW - padX, align: "right", characterSpacing: 0.5 });
  doc.y = top + 22;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.75).strokeColor(COLOR.hairline).stroke();

  for (const row of stock) {
    ensureSpace(doc, 24);
    const rowTop = doc.y;
    doc.font(FONT.medium).fontSize(8.5).fillColor(COLOR.ink).text(row.material, PAGE_MARGIN + padX, rowTop + 7, {
      width: nameW - padX * 2,
      ellipsis: true,
    });
    doc
      .font(FONT.semibold)
      .fontSize(8.5)
      .fillColor(row.lowStock ? COLOR.danger : COLOR.ink)
      .text(`${row.onHand} ${row.unit}`, PAGE_MARGIN + nameW, rowTop + 7, { width: qtyW - padX, align: "right" });
    doc.y = rowTop + 24;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
  }
  doc.y += RULE_GAP;
}

async function entriesSection(doc: Doc, data: MaterialReportPdfData, deps: MaterialReportPdfDeps): Promise<void> {
  sectionLabel(doc, `Movements${data.entries.length ? `  (${data.entries.length})` : ""}`);
  const width = innerWidth(doc);

  if (data.entries.length === 0) {
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text("No material movements recorded.", PAGE_MARGIN, doc.y, { width });
    return;
  }

  for (const entry of data.entries) {
    ensureSpace(doc, 60);
    const top = doc.y;

    const accent = entry.voided ? COLOR.muted : entry.type === "IN" ? COLOR.success : COLOR.brand;
    doc.roundedRect(PAGE_MARGIN, top + 1, 40, 14, 3).fillColor(accent).fill();
    doc
      .font(FONT.semibold)
      .fontSize(7.5)
      .fillColor("#FFFFFF")
      .text(entry.voided ? "VOID" : entry.type, PAGE_MARGIN, top + 4.5, { width: 40, align: "center" });

    doc
      .font(FONT.semibold)
      .fontSize(10)
      .fillColor(COLOR.ink)
      .text(`${entry.material}  —  ${entry.quantity} ${entry.unit}`, PAGE_MARGIN + 50, top, {
        width: width - 50,
      });
    const metaParts = [entry.occurredAt, entry.loggedBy ?? undefined].filter(Boolean).join("  ·  ");
    doc.font(FONT.regular).fontSize(8).fillColor(COLOR.muted).text(metaParts, PAGE_MARGIN + 50, doc.y + 1, {
      width: width - 50,
    });

    doc.y = Math.max(doc.y, top + 18) + 4;

    if (entry.reason) {
      doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.body).text(`Reason: ${entry.reason}`, PAGE_MARGIN + 50, doc.y, {
        width: width - 50,
      });
      doc.y += 4;
    }

    if (entry.notesHtml && entry.notesHtml.trim().length > 0) {
      doc.x = PAGE_MARGIN;
      await renderRichText(doc, entry.notesHtml, { resolveImage: deps.resolveImage, bodyFontSize: 9 });
    }

    doc.y += 6;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
    doc.y += RULE_GAP - 4;
  }
}

function footer(doc: Doc, data: MaterialReportPdfData): void {
  const range = doc.bufferedPageRange();
  const half = innerWidth(doc) / 2;
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - PAGE_MARGIN + 6;
    doc.moveTo(PAGE_MARGIN, y - 8).lineTo(doc.page.width - PAGE_MARGIN, y - 8).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
    doc.font(FONT.regular).fontSize(7.5).fillColor(COLOR.muted);
    doc.text(`Generated by BuildPanda · ${data.generatedAtLabel}`, PAGE_MARGIN, y, { width: half, align: "left", lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN + half, y, { width: half, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
}

export function renderMaterialReportPdf(
  data: MaterialReportPdfData,
  deps: MaterialReportPdfDeps,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Material Report — ${data.projectName} — ${data.reportDateLabel}`,
        Author: "BuildPanda",
        Creator: "BuildPanda",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    void (async () => {
      try {
        registerReportFonts(doc);
        doc.font(FONT.regular);
        masthead(doc, data);
        identityBlock(doc, data);
        stockTable(doc, data.stock);
        await entriesSection(doc, data, deps);
        footer(doc, data);
        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });
}
