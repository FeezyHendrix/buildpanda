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

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportActivityRow {
  name: string;
  phase: string | null;
  trade: string | null;
  assignee: string | null;
  status: string;
  percentComplete: number;
  hours: string;
}

export interface DailyReportPdfData {
  companyName: string;
  projectName: string;
  projectAddress?: string | null;
  reportDateLabel: string;
  generatedAtLabel: string;
  stageSummary?: ReportStage[];
  voided?: { reason: string; by: string | null; at: string } | null;
  overallProgressPercent: number;
  dailyProgressPercent: number;
  weather: ReportMetric[];
  workforce: ReportMetric[];
  activities: ReportActivityRow[];
  summary: string | null;
  notesHtml?: string | null;
  entries?: ReportPersonaEntry[];
}

export interface ReportStage {
  name: string;
  status: string;
  percent: number;
  current: boolean;
}

export interface ReportPersonaEntry {
  authorName: string;
  authorRole: string;
  addedAt: string;
  bodyHtml: string | null;
  voided: boolean;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface DailyReportPdfDeps {
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

function hairline(doc: Doc): void {
  const y = doc.y;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .lineWidth(0.75)
    .strokeColor(COLOR.hairline)
    .stroke();
}

function masthead(doc: Doc, data: DailyReportPdfData): void {
  const logoWidth = 104;
  doc.image(emailLogoPng, PAGE_MARGIN, PAGE_MARGIN, { width: logoWidth });

  doc
    .font(FONT.semibold)
    .fontSize(13)
    .fillColor(COLOR.ink)
    .text("Daily Site Report", PAGE_MARGIN, PAGE_MARGIN + 6, {
      width: innerWidth(doc),
      align: "right",
    });
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(COLOR.muted)
    .text(data.reportDateLabel, { width: innerWidth(doc), align: "right" });

  doc.y = PAGE_MARGIN + 46;
  hairline(doc);
  doc.y += RULE_GAP;
}

function identityBlock(doc: Doc, data: DailyReportPdfData): void {
  doc
    .font(FONT.bold)
    .fontSize(14)
    .fillColor(COLOR.ink)
    .text(data.projectName, PAGE_MARGIN, doc.y, { width: innerWidth(doc) });
  const meta = [data.companyName, data.projectAddress ?? undefined].filter(Boolean).join("   •   ");
  if (meta) {
    doc.moveDown(0.25);
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(meta, { width: innerWidth(doc) });
  }
  doc.y += RULE_GAP + 4;
}

function voidNotice(doc: Doc, voided: NonNullable<DailyReportPdfData["voided"]>): void {
  const width = innerWidth(doc);
  const pad = 12;
  doc.font(FONT.semibold).fontSize(9);
  const titleH = doc.heightOfString(`Voided — ${voided.reason}`, { width: width - pad * 2 - 10 });
  doc.font(FONT.regular).fontSize(8);
  const meta = voided.by ? `${voided.by} · ${voided.at}` : voided.at;
  const metaH = doc.heightOfString(meta, { width: width - pad * 2 - 10 });
  const boxH = titleH + metaH + pad * 2 + 3;
  ensureSpace(doc, boxH + RULE_GAP);

  const top = doc.y;
  doc.roundedRect(PAGE_MARGIN, top, width, boxH, 6).fillColor(COLOR.dangerTint).fill();
  doc.roundedRect(PAGE_MARGIN, top, 3, boxH, 1.5).fillColor(COLOR.danger).fill();
  doc
    .font(FONT.semibold)
    .fontSize(9)
    .fillColor(COLOR.danger)
    .text(`Voided — ${voided.reason}`, PAGE_MARGIN + pad + 6, top + pad, {
      width: width - pad * 2 - 10,
    });
  doc
    .font(FONT.regular)
    .fontSize(8)
    .fillColor(COLOR.body)
    .text(meta, PAGE_MARGIN + pad + 6, doc.y + 3, { width: width - pad * 2 - 10 });
  doc.y = top + boxH + RULE_GAP;
}

function progressRow(doc: Doc, label: string, percent: number, x: number, width: number): number {
  const pct = Math.max(0, Math.min(100, percent));
  const top = doc.y;
  doc.font(FONT.medium).fontSize(8.5).fillColor(COLOR.body).text(label, x, top, { width: width - 44 });
  doc
    .font(FONT.semibold)
    .fontSize(11)
    .fillColor(COLOR.ink)
    .text(`${pct.toFixed(0)}%`, x, top - 2, { width, align: "right" });
  const barY = top + 16;
  doc.roundedRect(x, barY, width, 5, 2.5).fillColor(COLOR.hairline).fill();
  if (pct > 0) {
    doc.roundedRect(x, barY, Math.max((width * pct) / 100, 3), 5, 2.5).fillColor(COLOR.brand).fill();
  }
  return barY + 5;
}

function progressSection(doc: Doc, data: DailyReportPdfData): void {
  sectionLabel(doc, "Progress");
  const width = innerWidth(doc);
  const gap = 32;
  const col = (width - gap) / 2;
  const startY = doc.y;
  const leftBottom = progressRow(doc, "Overall project completion", data.overallProgressPercent, PAGE_MARGIN, col);
  doc.y = startY;
  const rightBottom = progressRow(doc, "Today's activity progress", data.dailyProgressPercent, PAGE_MARGIN + col + gap, col);
  doc.y = Math.max(leftBottom, rightBottom) + RULE_GAP + 2;
}

function stageSection(doc: Doc, stages: ReportStage[]): void {
  if (!stages || stages.length === 0) return;
  const current = stages.find((s) => s.current);
  sectionLabel(doc, current ? `Construction stage — ${current.name}` : "Construction stage");
  const width = innerWidth(doc);

  for (const stage of stages) {
    ensureSpace(doc, 26);
    const top = doc.y;
    const pct = Math.max(0, Math.min(100, stage.percent));
    doc
      .font(stage.current ? FONT.semibold : FONT.medium)
      .fontSize(9)
      .fillColor(stage.current ? COLOR.brand : COLOR.ink)
      .text(stage.name, PAGE_MARGIN, top, { width: width * 0.5 - 8, ellipsis: true });
    doc
      .font(FONT.regular)
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(stage.status, PAGE_MARGIN + width * 0.5, top, { width: width * 0.22, align: "left" });
    doc
      .font(FONT.semibold)
      .fontSize(9)
      .fillColor(COLOR.ink)
      .text(`${pct.toFixed(0)}%`, PAGE_MARGIN, top, { width, align: "right" });

    const barY = top + 14;
    const barWidth = width;
    doc.roundedRect(PAGE_MARGIN, barY, barWidth, 4, 2).fillColor(COLOR.hairline).fill();
    if (pct > 0) {
      doc
        .roundedRect(PAGE_MARGIN, barY, Math.max((barWidth * pct) / 100, 3), 4, 2)
        .fillColor(stage.current ? COLOR.brand : COLOR.success)
        .fill();
    }
    doc.y = barY + 12;
  }
  doc.y += RULE_GAP - 6;
}

function definitionList(doc: Doc, title: string, items: ReportMetric[]): void {
  if (items.length === 0) return;
  sectionLabel(doc, title);
  const width = innerWidth(doc);
  const cols = 3;
  const colGap = 26;
  const colWidth = (width - colGap * (cols - 1)) / cols;
  let rowTop = doc.y;
  const rowHeight = 30;

  items.forEach((item, index) => {
    const col = index % cols;
    if (col === 0) {
      if (index > 0) rowTop += rowHeight;
      ensureSpace(doc, rowHeight);
      if (rowTop + rowHeight > bottomLimit(doc)) rowTop = doc.y;
    }
    const x = PAGE_MARGIN + col * (colWidth + colGap);
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLOR.muted)
      .text(item.label.toUpperCase(), x, rowTop, { width: colWidth, characterSpacing: 0.6 });
    doc
      .font(FONT.semibold)
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(item.value, x, rowTop + 11, { width: colWidth, ellipsis: true });
  });
  doc.y = rowTop + rowHeight + RULE_GAP - 6;
}

function activitiesSection(doc: Doc, rows: ReportActivityRow[]): void {
  sectionLabel(doc, `Activities logged${rows.length ? `  (${rows.length})` : ""}`);
  const width = innerWidth(doc);

  if (rows.length === 0) {
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text("No activities were linked to this daily log.", PAGE_MARGIN, doc.y, { width });
    doc.y += RULE_GAP;
    return;
  }

  const cols = [
    { label: "Activity", w: 0.34, align: "left" as const },
    { label: "Phase", w: 0.16, align: "left" as const },
    { label: "Assignee", w: 0.18, align: "left" as const },
    { label: "Status", w: 0.13, align: "left" as const },
    { label: "Done", w: 0.09, align: "right" as const },
    { label: "Hrs", w: 0.1, align: "right" as const },
  ].map((c) => ({ ...c, width: c.w * width }));
  const padX = 8;
  const headerH = 22;
  const nameColWidth = cols[0]?.width ?? width * 0.34;

  const drawHead = (): void => {
    const top = doc.y;
    let x = PAGE_MARGIN;
    doc.font(FONT.semibold).fontSize(7.5).fillColor(COLOR.muted);
    for (const c of cols) {
      doc.text(c.label.toUpperCase(), x + (c.align === "right" ? 0 : padX), top + 7, {
        width: c.width - padX,
        align: c.align,
        characterSpacing: 0.5,
      });
      x += c.width;
    }
    const ruleY = top + headerH - 1;
    doc.moveTo(PAGE_MARGIN, ruleY).lineTo(doc.page.width - PAGE_MARGIN, ruleY).lineWidth(0.75).strokeColor(COLOR.hairline).stroke();
    doc.y = top + headerH;
  };

  ensureSpace(doc, headerH + 30);
  drawHead();

  rows.forEach((row) => {
    const cellText = (label: string): string => {
      switch (label) {
        case "Activity": return row.name;
        case "Phase": return row.phase ?? "—";
        case "Assignee": return row.assignee ?? "—";
        case "Status": return row.status;
        case "Done": return `${Math.round(row.percentComplete)}%`;
        case "Hrs": return row.hours;
        default: return "";
      }
    };
    doc.font(FONT.regular).fontSize(8.5);
    const nameH = doc.heightOfString(row.name, { width: nameColWidth - padX * 2 });
    const tradeLine = row.trade ? 9 : 0;
    const rowH = Math.max(nameH + tradeLine + 13, 26);

    if (doc.y + rowH > bottomLimit(doc)) {
      doc.addPage();
      drawHead();
    }

    const top = doc.y;
    let x = PAGE_MARGIN;
    for (const c of cols) {
      if (c.label === "Done") {
        doc.font(FONT.semibold).fillColor(COLOR.ink);
      } else if (c.label === "Status") {
        doc.font(FONT.medium).fillColor(row.status === "Done" ? COLOR.success : COLOR.body);
      } else if (c.label === "Activity") {
        doc.font(FONT.medium).fillColor(COLOR.ink);
      } else {
        doc.font(FONT.regular).fillColor(COLOR.body);
      }
      doc.fontSize(8.5).text(cellText(c.label), x + (c.align === "right" ? 0 : padX), top + 7, {
        width: c.width - padX,
        align: c.align,
        ellipsis: c.label !== "Activity",
      });
      x += c.width;
    }

    if (row.trade) {
      doc
        .font(FONT.regular)
        .fontSize(7.5)
        .fillColor(COLOR.muted)
        .text(row.trade, PAGE_MARGIN + padX, top + 7 + nameH + 1, {
          width: nameColWidth - padX * 2,
          ellipsis: true,
        });
    }

    const lineY = top + rowH;
    doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
    doc.y = lineY;
  });

  doc.y += RULE_GAP - 4;
}

async function summarySection(
  doc: Doc,
  data: DailyReportPdfData,
  deps: DailyReportPdfDeps,
): Promise<void> {
  const entries = data.entries ?? [];
  if (entries.length > 0) {
    sectionLabel(doc, `Team logs${entries.length ? `  (${entries.length})` : ""}`);
    const width = innerWidth(doc);
    for (const entry of entries) {
      ensureSpace(doc, 46);
      const top = doc.y;
      doc
        .font(FONT.semibold)
        .fontSize(10)
        .fillColor(entry.voided ? COLOR.muted : COLOR.ink)
        .text(entry.authorName, PAGE_MARGIN, top, { width: width - 120, continued: false });
      doc
        .font(FONT.regular)
        .fontSize(8)
        .fillColor(COLOR.muted)
        .text(entry.authorRole.toUpperCase(), PAGE_MARGIN, top, {
          width,
          align: "right",
          characterSpacing: 0.5,
        });
      doc.y = Math.max(doc.y, top + 13);
      doc
        .font(FONT.regular)
        .fontSize(7.5)
        .fillColor(COLOR.muted)
        .text(`Added ${entry.addedAt}`, PAGE_MARGIN, doc.y, { width });
      doc.y += 2;

      if (entry.voided) {
        const voidMeta = entry.voidedBy
          ? `Voided by ${entry.voidedBy} on ${entry.voidedAt ?? ""}`
          : `Voided${entry.voidedAt ? ` on ${entry.voidedAt}` : ""}`;
        doc
          .font(FONT.semibold)
          .fontSize(8)
          .fillColor(COLOR.danger)
          .text(`VOIDED${entry.voidReason ? ` — ${entry.voidReason}` : ""}`, PAGE_MARGIN, doc.y + 2, { width });
        doc
          .font(FONT.regular)
          .fontSize(7.5)
          .fillColor(COLOR.danger)
          .text(voidMeta, PAGE_MARGIN, doc.y + 1, { width });
        doc.y += 4;
      }

      if (entry.bodyHtml && entry.bodyHtml.trim().length > 0) {
        doc.x = PAGE_MARGIN;
        await renderRichText(doc, entry.bodyHtml, { resolveImage: deps.resolveImage, bodyFontSize: 9 });
      }

      doc.y += 4;
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
      doc.y += RULE_GAP - 4;
    }
    return;
  }

  sectionLabel(doc, "Site notes");
  const width = innerWidth(doc);
  const hasRich = Boolean(data.notesHtml && data.notesHtml.trim().length > 0);
  const hasPlain = Boolean(data.summary && data.summary.trim().length > 0);

  if (hasRich) {
    await renderRichText(doc, data.notesHtml!, { resolveImage: deps.resolveImage });
  } else if (hasPlain) {
    doc
      .font(FONT.regular)
      .fontSize(9.5)
      .fillColor(COLOR.body)
      .text(data.summary!, PAGE_MARGIN, doc.y, { width, lineGap: 3.5 });
  } else {
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text("No notes were recorded for this day.", PAGE_MARGIN, doc.y, { width });
  }
}

function footer(doc: Doc, data: DailyReportPdfData): void {
  const range = doc.bufferedPageRange();
  const half = innerWidth(doc) / 2;
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - PAGE_MARGIN + 6;
    doc.moveTo(PAGE_MARGIN, y - 8).lineTo(doc.page.width - PAGE_MARGIN, y - 8).lineWidth(0.5).strokeColor(COLOR.hairline).stroke();
    doc.font(FONT.regular).fontSize(7.5).fillColor(COLOR.muted);
    doc.text(`Generated by BuildPanda · ${data.generatedAtLabel}`, PAGE_MARGIN, y, {
      width: half,
      align: "left",
      lineBreak: false,
    });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN + half, y, {
      width: half,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

export function renderDailyReportPdf(
  data: DailyReportPdfData,
  deps: DailyReportPdfDeps,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Daily Site Report — ${data.projectName} — ${data.reportDateLabel}`,
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
        if (data.voided) voidNotice(doc, data.voided);
        progressSection(doc, data);
        if (data.stageSummary) stageSection(doc, data.stageSummary);
        definitionList(doc, "Workforce", data.workforce);
        definitionList(doc, "Weather", data.weather);
        activitiesSection(doc, data.activities);
        await summarySection(doc, data, deps);
        footer(doc, data);
        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });
}
