import PDFDocument from "pdfkit";
import { emailLogoPng } from "../../lib/email-assets.ts";
import {
  COLOR,
  FONT,
  PAGE_MARGIN,
  RULE_GAP,
  registerReportFonts,
  reportBottomLimit,
  reportInnerWidth,
  type ReportDoc,
} from "../../lib/report-theme.ts";
import { renderRichText } from "../../lib/report-richtext.ts";
import type { Estimate, EstimateItem, PackSection, PaymentScheduleItem, Proposal } from "./types.ts";

// The PDF is the thing the client accepted. It is generated at send, stored,
// hashed, and never regenerated for that revision.

export interface SnapshotData {
  proposal: Proposal;
  estimate: Estimate;
  items: EstimateItem[];
  schedule: PaymentScheduleItem[];
  sections: PackSection[];
  company: { name: string; address: string | null; phone: string | null; email: string | null };
}

const SECTION_TITLES: Record<PackSection["kind"], string> = {
  scope: "Scope of works",
  exclusions: "Exclusions",
  assumptions: "Assumptions",
  provisional_sums: "Provisional sums",
  warranties: "Warranties",
  terms: "Terms and conditions",
  site_survey: "Site survey",
};

const CLIENT_SECTIONS: PackSection["kind"][] = ["scope", "exclusions", "assumptions", "provisional_sums", "warranties", "terms"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function ensureSpace(doc: ReportDoc, needed: number): void {
  if (doc.y + needed > reportBottomLimit(doc)) doc.addPage();
}

function heading(doc: ReportDoc, text: string): void {
  ensureSpace(doc, 34);
  doc.font(FONT.semibold).fontSize(8).fillColor(COLOR.muted).text(text.toUpperCase(), PAGE_MARGIN, doc.y, { characterSpacing: 1.1 });
  doc.moveDown(0.45);
}

function hairline(doc: ReportDoc): void {
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.75).strokeColor(COLOR.hairline).stroke();
}

function row(doc: ReportDoc, label: string, value: string, strong = false): void {
  ensureSpace(doc, 16);
  const width = reportInnerWidth(doc);
  const y = doc.y;
  doc.font(strong ? FONT.semibold : FONT.regular).fontSize(9.5).fillColor(strong ? COLOR.ink : COLOR.body);
  doc.text(label, PAGE_MARGIN, y, { width: width * 0.66 });
  doc.text(value, PAGE_MARGIN + width * 0.66, y, { width: width * 0.34, align: "right" });
  doc.y = y + 15;
}

function masthead(doc: ReportDoc, data: SnapshotData): void {
  doc.image(emailLogoPng, PAGE_MARGIN, PAGE_MARGIN, { width: 96 });
  doc.font(FONT.semibold).fontSize(13).fillColor(COLOR.ink).text("Proposal", PAGE_MARGIN, PAGE_MARGIN + 4, { width: reportInnerWidth(doc), align: "right" });
  doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text(`${data.proposal.numberLabel} · ${data.estimate.revisionLabel}`, { width: reportInnerWidth(doc), align: "right" });
  doc.y = PAGE_MARGIN + 46;
  hairline(doc);
  doc.y += RULE_GAP;
  doc.font(FONT.bold).fontSize(15).fillColor(COLOR.ink).text(data.proposal.title, PAGE_MARGIN, doc.y, { width: reportInnerWidth(doc) });
  doc.moveDown(0.25);
  const meta = [`Prepared for ${data.proposal.clientName}`, data.proposal.location ?? undefined, `by ${data.company.name}`].filter(Boolean).join("   •   ");
  doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text(meta, { width: reportInnerWidth(doc) });
  doc.y += RULE_GAP;
}

function priceBlock(doc: ReportDoc, data: SnapshotData): void {
  const { estimate, proposal, items } = data;
  heading(doc, "Price");
  if (estimate.clientVisibleDetail === "lines") {
    for (const item of items) {
      row(doc, `${item.description} · ${item.qty} ${item.unit}`, money(item.total, proposal.currency));
    }
  } else {
    const groups = new Map<string, number>();
    for (const item of items) groups.set(item.groupLabel, (groups.get(item.groupLabel) ?? 0) + item.total);
    for (const [label, total] of groups) row(doc, label, money(total, proposal.currency));
  }
  doc.y += 4;
  hairline(doc);
  doc.y += 6;
  row(doc, "Subtotal", money(estimate.subtotal, proposal.currency));
  if (estimate.contingencyPct > 0) row(doc, `Contingency (${estimate.contingencyPct} %)`, money((estimate.subtotal * estimate.contingencyPct) / 100, proposal.currency));
  row(doc, `${estimate.taxLabel} (${estimate.taxPct} %)`, money(estimate.taxAmount, proposal.currency));
  row(doc, "Total", money(estimate.total, proposal.currency), true);
  doc.y += RULE_GAP;
}

function scheduleBlock(doc: ReportDoc, data: SnapshotData): void {
  if (data.schedule.length === 0) return;
  heading(doc, "Payment stages");
  for (const stage of data.schedule) {
    const amount = (data.estimate.total * stage.percent) / 100;
    row(doc, `${stage.label}${stage.kind === "advance" ? " (advance)" : ""} · ${stage.percent} %`, money(amount, data.proposal.currency));
  }
  const terms: string[] = [];
  if (data.estimate.retentionPct) terms.push(`Retention ${data.estimate.retentionPct} % (${data.estimate.retentionMode ?? "cash"})`);
  if (data.estimate.whtPct) terms.push(`Client deducts withholding tax at ${data.estimate.whtPct} %`);
  if (data.estimate.paymentTermsDays) terms.push(`Payment within ${data.estimate.paymentTermsDays} days of each stage`);
  if (data.estimate.defectsLiabilityDays) terms.push(`Defects liability ${data.estimate.defectsLiabilityDays} days`);
  if (terms.length > 0) {
    doc.moveDown(0.3);
    doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.muted).text(terms.join("  •  "), PAGE_MARGIN, doc.y, { width: reportInnerWidth(doc) });
  }
  doc.y += RULE_GAP;
}

async function packSections(doc: ReportDoc, data: SnapshotData): Promise<void> {
  for (const kind of CLIENT_SECTIONS) {
    const section = data.sections.find((s) => s.kind === kind);
    if (!section || !section.bodyHtml.trim()) continue;
    heading(doc, SECTION_TITLES[kind]);
    await renderRichText(doc, section.bodyHtml, { resolveImage: async () => null, bodyFontSize: 9.5 });
    doc.y += RULE_GAP;
  }
}

function footer(doc: ReportDoc, data: SnapshotData): void {
  ensureSpace(doc, 40);
  hairline(doc);
  doc.y += 8;
  const validity = data.proposal.validUntil ? `Valid until ${new Date(data.proposal.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` : "";
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.muted).text(
    `${validity} Figures are recorded amounts; BuildPanda logs payments, it does not move money. Generated ${new Date().toLocaleString("en-GB")}.`,
    PAGE_MARGIN,
    doc.y,
    { width: reportInnerWidth(doc) },
  );
}

export async function renderProposalSnapshot(data: SnapshotData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, info: { Title: `${data.proposal.numberLabel} ${data.proposal.title}` } });
  registerReportFonts(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });
  masthead(doc, data);
  const scope = data.sections.find((s) => s.kind === "scope");
  if (!scope && data.proposal.brief) {
    heading(doc, "Scope of works");
    doc.font(FONT.regular).fontSize(9.5).fillColor(COLOR.body).text(data.proposal.brief, PAGE_MARGIN, doc.y, { width: reportInnerWidth(doc) });
    doc.y += RULE_GAP;
  }
  await packSections(doc, data);
  priceBlock(doc, data);
  scheduleBlock(doc, data);
  footer(doc, data);
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
