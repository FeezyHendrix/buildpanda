import { parse, type HTMLElement as ParsedElement, type Node as ParsedNode } from "node-html-parser";
import {
  COLOR,
  FONT,
  PAGE_MARGIN,
  reportBottomLimit,
  reportInnerWidth,
  type ReportDoc,
} from "./report-theme.ts";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export interface ResolvedImage {
  bytes: Buffer;
  width: number;
  height: number;
  alt: string;
}

export interface RichTextOptions {
  resolveImage: (fileId: string) => Promise<ResolvedImage | null>;
  bodyFontSize?: number;
}

interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

function isElement(node: ParsedNode): node is ParsedElement {
  return node.nodeType === ELEMENT_NODE;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function collectRuns(node: ParsedNode, bold: boolean, italic: boolean, out: InlineRun[]): void {
  if (node.nodeType === TEXT_NODE) {
    const text = decodeEntities((node as { rawText: string }).rawText).replace(/\s+/g, " ");
    if (text) out.push({ text, bold, italic });
    return;
  }
  if (!isElement(node)) return;
  const tag = node.rawTagName?.toLowerCase();
  const nextBold = bold || tag === "strong" || tag === "b";
  const nextItalic = italic || tag === "em" || tag === "i";
  if (tag === "br") {
    out.push({ text: "\n", bold, italic });
    return;
  }
  for (const child of node.childNodes) collectRuns(child, nextBold, nextItalic, out);
}

function fontFor(run: InlineRun): string {
  if (run.bold) return FONT.semibold;
  if (run.italic) return FONT.regular;
  return FONT.regular;
}

function ensureSpace(doc: ReportDoc, needed: number): void {
  if (doc.y + needed > reportBottomLimit(doc)) doc.addPage();
}

function writeInline(
  doc: ReportDoc,
  runs: InlineRun[],
  opts: { x: number; width: number; fontSize: number; color: string; lineGap: number },
): void {
  const merged = runs.filter((r) => r.text.length > 0);
  if (merged.length === 0) return;
  ensureSpace(doc, opts.fontSize + 6);
  const startY = doc.y;
  merged.forEach((run, index) => {
    const isLast = index === merged.length - 1;
    doc.font(fontFor(run)).fontSize(opts.fontSize).fillColor(opts.color);
    const options = {
      width: opts.width,
      continued: !isLast,
      lineGap: opts.lineGap,
      oblique: run.italic,
    };
    if (index === 0) {
      doc.text(run.text, opts.x, startY, options);
    } else {
      doc.text(run.text, options);
    }
  });
}

function fileIdFromSrc(src: string): string | null {
  const match = src.match(/\/files\/([^/?]+)\/download/);
  return match ? (match[1] ?? null) : null;
}

async function renderImage(
  doc: ReportDoc,
  el: ParsedElement,
  width: number,
  resolve: RichTextOptions["resolveImage"],
): Promise<void> {
  const src = el.getAttribute("src") ?? "";
  const fileId = fileIdFromSrc(src);
  if (!fileId) return;
  const image = await resolve(fileId);
  if (!image || image.width <= 0 || image.height <= 0) return;

  const maxWidth = Math.min(width, 360);
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  if (doc.y + drawHeight > reportBottomLimit(doc)) doc.addPage();
  doc.image(image.bytes, PAGE_MARGIN, doc.y, { width: drawWidth });
  doc.y += drawHeight + 6;

  if (image.alt) {
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLOR.muted)
      .text(image.alt, PAGE_MARGIN, doc.y, { width });
    doc.y += 4;
  }
  doc.y += 6;
}

async function renderBlock(
  doc: ReportDoc,
  el: ParsedElement,
  width: number,
  opts: RichTextOptions,
): Promise<void> {
  const tag = el.rawTagName?.toLowerCase();
  const body = opts.bodyFontSize ?? 9.5;

  switch (tag) {
    case "h1":
    case "h2":
    case "h3": {
      const size = tag === "h1" ? 13 : tag === "h2" ? 11.5 : 10.5;
      const runs: InlineRun[] = [];
      for (const child of el.childNodes) collectRuns(child, true, false, runs);
      doc.moveDown(0.4);
      ensureSpace(doc, size + 8);
      writeInline(doc, runs, { x: PAGE_MARGIN, width, fontSize: size, color: COLOR.ink, lineGap: 1 });
      doc.y += 4;
      break;
    }
    case "ul":
    case "ol": {
      let index = 1;
      for (const li of el.childNodes) {
        if (!isElement(li) || li.rawTagName?.toLowerCase() !== "li") continue;
        const bullet = tag === "ol" ? `${index}.` : "•";
        const runs: InlineRun[] = [];
        for (const child of li.childNodes) collectRuns(child, false, false, runs);
        ensureSpace(doc, body + 6);
        const top = doc.y;
        doc.font(FONT.regular).fontSize(body).fillColor(COLOR.body).text(bullet, PAGE_MARGIN, top, { width: 16 });
        doc.y = top;
        writeInline(doc, runs, {
          x: PAGE_MARGIN + 18,
          width: width - 18,
          fontSize: body,
          color: COLOR.body,
          lineGap: 2,
        });
        doc.x = PAGE_MARGIN;
        doc.y += 3;
        index += 1;
      }
      doc.y += 4;
      break;
    }
    case "blockquote": {
      const runs: InlineRun[] = [];
      for (const child of el.childNodes) collectRuns(child, false, true, runs);
      ensureSpace(doc, body + 10);
      const top = doc.y;
      writeInline(doc, runs, {
        x: PAGE_MARGIN + 12,
        width: width - 12,
        fontSize: body,
        color: COLOR.body,
        lineGap: 2,
      });
      doc.moveTo(PAGE_MARGIN, top).lineTo(PAGE_MARGIN, doc.y).lineWidth(2).strokeColor(COLOR.hairline).stroke();
      doc.x = PAGE_MARGIN;
      doc.y += 6;
      break;
    }
    case "figure":
    case "p": {
      const img = el.querySelector?.("img");
      if (img) {
        await renderImage(doc, img, width, opts.resolveImage);
        return;
      }
      const runs: InlineRun[] = [];
      for (const child of el.childNodes) collectRuns(child, false, false, runs);
      if (runs.every((r) => r.text.trim().length === 0)) {
        doc.y += 5;
        return;
      }
      writeInline(doc, runs, { x: PAGE_MARGIN, width, fontSize: body, color: COLOR.body, lineGap: 3 });
      doc.x = PAGE_MARGIN;
      doc.y += 6;
      break;
    }
    case "img": {
      await renderImage(doc, el, width, opts.resolveImage);
      break;
    }
    default: {
      const runs: InlineRun[] = [];
      for (const child of el.childNodes) collectRuns(child, false, false, runs);
      if (runs.some((r) => r.text.trim().length > 0)) {
        writeInline(doc, runs, { x: PAGE_MARGIN, width, fontSize: body, color: COLOR.body, lineGap: 3 });
        doc.x = PAGE_MARGIN;
        doc.y += 6;
      }
    }
  }
}

export async function renderRichText(
  doc: ReportDoc,
  html: string,
  opts: RichTextOptions,
): Promise<void> {
  const width = reportInnerWidth(doc);
  const root = parse(html, { comment: false });
  doc.x = PAGE_MARGIN;
  for (const node of root.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      const text = decodeEntities((node as { rawText: string }).rawText).trim();
      if (text) {
        writeInline(doc, [{ text, bold: false, italic: false }], {
          x: PAGE_MARGIN,
          width,
          fontSize: opts.bodyFontSize ?? 9.5,
          color: COLOR.body,
          lineGap: 3,
        });
        doc.x = PAGE_MARGIN;
        doc.y += 6;
      }
      continue;
    }
    if (isElement(node)) await renderBlock(doc, node, width, opts);
  }
  doc.x = PAGE_MARGIN;
}
