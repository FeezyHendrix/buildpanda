import { openStoredFile, streamToBuffer } from "../../../lib/file-storage.ts";
import { extractDocumentText } from "../../../lib/document-text.ts";
import { renderPdfPagesToPng, pngToDataUrl } from "../../../lib/document-render.ts";
import { chatVision } from "../../../lib/llm-vision.ts";
import { agentRepository } from "./repository.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";

const MAX_DOC_TEXT_CHARS = 16000;

export function documentsTools(): AgentTool[] {
  return [
    tool(fn("get_drawing_markups", "Get unresolved markup raised on the project's DRAWING SHEETS — redlines, revision clouds and pinned comments, with the sheet and revision they were raised against and whether that revision has since been superseded. Use ONLY when the question is about the drawings themselves: 'what is outstanding on the drawings', 'what did the architect flag', 'which comments are on a superseded revision', 'which RFIs came off a drawing'. This tool holds no activities, delays, RFIs, risks, inspections, changes or orders, so it is the WRONG tool for 'what changed on culvert 1' or any question naming a piece of work — use find_work_records for those. Most projects have no markup at all; an empty result here means nothing was redlined, never that the project has no information about the thing asked about."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const markups = await repo.drawingMarkupsOpen(ctx.projectId);
      return {
        output: {
          markups: markups.map((m) => ({
            sheet: m.sheet,
            revision: m.revision,
            onCurrentRevision: Boolean(m.on_current_revision),
            kind: m.kind,
            comment: m.comment,
            raisedBy: m.raisedBy,
            raisedOn: m.created_at,
            rfiRaised: Boolean(m.rfiId),
          })),
        },
      };
    }),

    tool(fn("list_documents", "List the documents and drawings on file for the project (name + category). Use this before analyzing a document so you know what exists."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const docs = await repo.documents(ctx.projectId);
      return { output: docs.map((d) => ({ id: d.id, fileName: d.file_name, category: d.categoryName, group: d.categoryGroup })) };
    }),

    tool(fn("analyze_document", "Read and extract the text of a specific document (PDF, Word, Excel, CSV). Use when the user asks about the contents of a document. Pass the documentId from list_documents.", { documentId: { type: "string", description: "The document id from list_documents" } }, ["documentId"]), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const doc = await repo.documentFile(ctx.projectId, String(args.documentId));
      if (!doc) return { output: { error: "Document not found in this project." } };
      if (!doc.storage_path) return { output: { error: "This document has no file attached." } };
      try {
        const buffer = await streamToBuffer(await openStoredFile(doc.storage_path));
        const extracted = await extractDocumentText(buffer, doc.file_name);
        const text = extracted.text.slice(0, MAX_DOC_TEXT_CHARS);
        return {
          output: {
            fileName: doc.file_name,
            pageCount: extracted.pageCount,
            truncated: extracted.truncated || extracted.text.length > MAX_DOC_TEXT_CHARS,
            text,
          },
        };
      } catch (error) {
        return { output: { error: error instanceof Error ? error.message : "Could not read this document." } };
      }
    }),

    tool(fn("analyze_drawing", "Look at and describe an architectural/engineering drawing or a site photo (floor plan, elevation, section, structural, MEP, or an image). Use for drawings, plans, and photos where the visual content matters. Pass the documentId from list_documents.", { documentId: { type: "string", description: "The document id from list_documents" } }, ["documentId"]), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const doc = await repo.documentFile(ctx.projectId, String(args.documentId));
      if (!doc) return { output: { error: "Document not found in this project." } };
      if (!doc.storage_path) return { output: { error: "This document has no file attached." } };
      const lower = doc.file_name.toLowerCase();
      const isImage = /\.(png|jpe?g|webp|gif)$/.test(lower);
      const isPdf = lower.endsWith(".pdf");
      if (!isPdf && !isImage) {
        return { output: { error: "Visual analysis supports PDF drawings and image files (.png, .jpg). Ask the user to export the drawing to PDF." } };
      }
      try {
        const buffer = await streamToBuffer(await openStoredFile(doc.storage_path));
        let images: string[];
        let pagesAnalyzed: number;
        if (isPdf) {
          const pngs = await renderPdfPagesToPng(buffer, { maxPages: 2, dpi: 150 });
          if (pngs.length === 0) return { output: { error: "Could not render this drawing." } };
          images = pngs.map((p) => pngToDataUrl(p));
          pagesAnalyzed = pngs.length;
        } else {
          const mime = doc.mime_type ?? "image/png";
          images = [`data:${mime};base64,${buffer.toString("base64")}`];
          pagesAnalyzed = 1;
        }
        const description = await chatVision(
          `This is "${doc.file_name}" from a construction project. If it is a drawing, describe the discipline, sheet title if visible, the spaces/rooms or systems depicted, major elements and callouts, and any revision or scale info you can read (note you cannot read fine dimensions reliably). If it is a photo, describe what is happening on site.`,
          images,
          { detail: "low" },
        );
        return { output: { fileName: doc.file_name, pagesAnalyzed, description: description ?? "No description produced." } };
      } catch (error) {
        return { output: { error: error instanceof Error ? error.message : "Could not analyze this drawing." } };
      }
    }),
  ];
}
