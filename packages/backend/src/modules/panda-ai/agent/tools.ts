import type { Knex } from "knex";
import { openStoredFile, streamToBuffer } from "../../../lib/file-storage.ts";
import { extractDocumentText } from "../../../lib/document-text.ts";
import { renderPdfPagesToPng, pngToDataUrl } from "../../../lib/document-render.ts";
import { chatVision, type LlmTool } from "../../../lib/llm.ts";
import { agentRepository } from "./repository.ts";

export interface ToolResult {
  output: unknown;
  navigate?: string;
}

export interface ToolContext {
  db: Knex;
  projectId: string;
}

interface AgentTool {
  spec: LlmTool;
  run(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}

const NAV_TARGETS: Record<string, string> = {
  overview: "overview",
  updates: "updates",
  materials: "materials",
  equipment: "equipment-requests",
  schedule: "project-chart",
  gantt: "project-chart",
  "project-chart": "project-chart",
  activities: "activities",
  "site-activity": "activities",
  "daily-log": "daily-log",
  "daily-logs": "daily-log",
  "key-dates": "key-dates",
  milestones: "milestones",
  stages: "stages",
  "whats-next": "whats-next",
  inspections: "inspections",
  "action-items": "action-items",
  queries: "queries",
  approvals: "approvals",
  "change-requests": "change-requests",
  permits: "permits",
  finances: "finances",
  budget: "finances/budget",
  invoices: "finances/invoices",
  "milestone-payments": "finances/milestone-payments",
  documents: "documents",
  team: "team",
  settings: "settings",
};

function tool(spec: LlmTool, run: AgentTool["run"]): AgentTool {
  return { spec, run };
}

function fn(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): LlmTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required, additionalProperties: false },
    },
  };
}

const MAX_DOC_TEXT_CHARS = 16000;

export function buildTools(): AgentTool[] {
  return [
    tool(fn("get_schedule", "Get the project schedule: phases and activities with dates, % complete, milestones and dependency counts. Use for any question about the timeline, Gantt, what's on schedule, or what is late."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [phases, activities] = await Promise.all([repo.phases(ctx.projectId), repo.activities(ctx.projectId)]);
      const now = Date.now();
      return {
        output: {
          phases: phases.map((p) => ({ id: p.id, name: p.name, status: p.status })),
          activities: activities.map((a) => {
            const preds = a.predecessors;
            const depCount = Array.isArray(preds) ? preds.length : typeof preds === "string" ? safeLen(preds) : 0;
            const end = a.planned_end_at ? new Date(String(a.planned_end_at)).getTime() : null;
            return {
              name: a.name,
              status: a.status,
              start: a.planned_start_at,
              end: a.planned_end_at,
              percentComplete: Number(a.percent_complete ?? 0),
              isMilestone: Boolean(a.is_milestone),
              dependencyCount: depCount,
              overdue: end !== null && end < now && a.status !== "Completed",
            };
          }),
        },
      };
    }),

    tool(fn("get_delays", "Get all logged delays for the project with their cost impact and resolution status. Use for questions about delays, lost time, or schedule slippage."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const delays = await repo.delays(ctx.projectId);
      return {
        output: delays.map((d) => ({
          activity: d.activityName,
          reason: d.reason_code,
          costImpact: Number(d.cost_impact ?? 0),
          startedAt: d.started_at,
          resolved: d.resolved_at !== null,
          notes: d.description,
        })),
      };
    }),

    tool(fn("get_risks", "Get the project risk register (risk factors by severity). Use for questions about risks or what could go wrong."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const risks = await repo.risks(ctx.projectId);
      return { output: risks.map((r) => ({ title: r.title, description: r.description, severity: r.severity })) };
    }),

    tool(fn("get_finances", "Get the project budget, spend, escrow and milestone payments. Use for questions about money, budget, cashflow or payments."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [fin, milestones] = await Promise.all([repo.finances(ctx.projectId), repo.milestonePayments(ctx.projectId)]);
      return {
        output: {
          finances: fin ?? null,
          milestonePayments: milestones.map((m) => ({
            name: m.name,
            status: m.status,
            percentComplete: Number(m.percent_complete ?? 0),
            amount: Number(m.amount ?? 0),
            verified: Boolean(m.proof_verified),
          })),
        },
      };
    }),

    tool(fn("get_daily_logs", "Get recent daily site logs (weather, workers present, hours, summary). Use for questions about site activity, what happened on site, or recent progress.", { limit: { type: "number", description: "How many recent logs (default 10)" } }), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const limit = Math.min(Math.max(Number(args.limit ?? 10), 1), 30);
      const logs = await repo.dailyLogs(ctx.projectId, limit);
      return {
        output: logs.map((l) => ({
          date: l.log_date,
          weather: l.weather_condition,
          temperatureC: l.temperature_c,
          workers: `${l.workers_present ?? "?"}/${l.workers_expected ?? "?"}`,
          hours: l.total_hours,
          summary: l.summary,
        })),
      };
    }),

    tool(fn("get_key_dates", "Get project key dates and milestones with their status (upcoming/met/missed)."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const dates = await repo.keyDates(ctx.projectId);
      return { output: dates.map((d) => ({ label: d.label, target: d.target_date, actual: d.actual_date, status: d.status })) };
    }),

    tool(fn("get_inspections", "Get project inspections with status and risk level."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const inspections = await repo.inspections(ctx.projectId);
      return { output: inspections.map((i) => ({ title: i.title, category: i.category, status: i.status, riskLevel: i.risk_level, scheduledAt: i.scheduled_at })) };
    }),

    tool(fn("get_materials", "Get planned material orders and requests (what was ordered) with status, supplier and cost. This is the procurement list, NOT current stock on hand — for how much of a material is currently available, use get_material_stock."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const materials = await repo.materials(ctx.projectId);
      return { output: materials.map((m) => ({ material: m.material_name, quantity: m.quantity, unit: m.unit, supplier: m.supplier, status: m.status, neededBy: m.needed_by, estimatedCost: m.estimated_cost })) };
    }),

    tool(fn("get_material_stock", "Get the live on-hand stock for each material from the materials ledger (received IN minus used). Use this for any question about how much of a material is currently available, in stock, remaining, received, or running low."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const stock = await repo.materialStock(ctx.projectId);
      return {
        output: stock.map((s) => ({
          material: s.material_name,
          unit: s.unit,
          location: s.location_key,
          onHand: Number(s.on_hand_qty),
          lowStockThreshold: s.low_stock_threshold === null ? null : Number(s.low_stock_threshold),
          lowStock: s.low_stock_threshold !== null && Number(s.on_hand_qty) <= Number(s.low_stock_threshold),
        })),
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

    tool(fn("navigate", "Point the user to a page in the app. Returns a navigation target the UI shows as a button. Use when the user asks to go somewhere or you reference a page they should open.", { target: { type: "string", description: `One of: ${Object.keys(NAV_TARGETS).join(", ")}` } }, ["target"]), async (ctx, args) => {
      const key = String(args.target ?? "").toLowerCase();
      const slug = NAV_TARGETS[key];
      if (!slug) return { output: { error: `Unknown target. Valid: ${Object.keys(NAV_TARGETS).join(", ")}` } };
      const path = `/project/${ctx.projectId}/${slug}`;
      return { output: { navigatedTo: path }, navigate: path };
    }),
  ];
}

function safeLen(json: string): number {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
