import type { Knex } from "knex";
import { openStoredFile, streamToBuffer } from "../../../lib/file-storage.ts";
import { extractDocumentText } from "../../../lib/document-text.ts";
import { renderPdfPagesToPng, pngToDataUrl } from "../../../lib/document-render.ts";
import { chatVision, type LlmTool } from "../../../lib/llm.ts";
import { assertCanActAsClient, assertCanModifyProject } from "../../../lib/authorization.ts";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { tasksRepository } from "../../tasks/repository.ts";
import { tasksService } from "../../tasks/service.ts";
import { queriesRepository } from "../../queries/repository.ts";
import { queriesService } from "../../queries/service.ts";
import { rfisRepository } from "../../rfis/repository.ts";
import { rfisService } from "../../rfis/service.ts";
import { notificationsRepository } from "../../notifications/repository.ts";
import { notificationsService } from "../../notifications/service.ts";
import { agentRepository } from "./repository.ts";

export interface ToolResult {
  output: unknown;
  navigate?: string;
}

/**
 * The calling user's identity and authorization inputs, captured from the
 * request that started the chat turn (same data the auth plugin loads).
 * Write tools re-run the exact assertions the domain routes run, so the
 * agent can never do more than the user could do themselves.
 */
export interface AgentCaller {
  user: { id: string; name: string };
  project: { id: string; ownerId: string | null; organizationId: string | null };
  orgRoles: ReadonlyMap<string, string>;
  projectRoles: ReadonlyMap<string, string>;
}

export interface ToolContext {
  db: Knex;
  projectId: string;
  caller: AgentCaller;
  queue?: QueueManager;
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
  "look-aheads": "look-aheads",
  "look-ahead": "look-aheads",
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
  "purchase-orders": "finances/purchase-orders",
  "payment-claims": "finances/payment-claims",
  tasks: "tasks",
  rfis: "rfis",
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, maxLength) : null;
}

function requiredString(value: unknown, maxLength: number, field: string): string {
  const s = optionalString(value, maxLength);
  if (!s) throw new Error(`${field} is required`);
  return s;
}

// The stored invoice workflow statuses; payment state (paid/overdue) is derived
// from payments + due date, so it is exposed as amountPaid/outstanding/isOverdue.
const INVOICE_WORKFLOW_STATUSES = ["Draft", "Sent", "Approved", "Submitted"] as const;

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

    tool(fn("get_finance_events", "Get the funding trail — a chronological log of who did what on this project's finances (funded the project, released a milestone from escrow, created/updated/removed a milestone, raised a dispute), with the actor and when. Use for questions about finance activity, history, or who recorded a funding action. Note: BuildPanda only LOGS these actions; it does not move money."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const rows = (await repo.financeEvents(ctx.projectId)) as {
        type: string;
        actor_name: string;
        summary: string;
        amount: string | null;
        created_at: string;
      }[];
      return {
        output: rows.map((r) => ({
          action: r.summary,
          by: r.actor_name,
          amount: r.amount === null ? null : Number(r.amount),
          at: r.created_at,
        })),
      };
    }),

    tool(fn("get_invoices", "Get the project's invoices in detail: number, vendor, billed-to party, workflow status, issue/due dates, total, amount paid, outstanding balance and an isOverdue flag. Use for questions about specific invoices, what is unpaid, or what is overdue. get_finances is only the high-level budget summary.", { status: { type: "string", enum: [...INVOICE_WORKFLOW_STATUSES], description: "Optional workflow status filter" } }), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const status = optionalString(args.status, 20) ?? undefined;
      const invoices = (await repo.invoices(ctx.projectId, status)) as Array<{
        id: string;
        number: string | null;
        vendor_name: string;
        invoice_type: string;
        status: string;
        currency: string;
        issue_date: string | null;
        due_date: string | null;
        total_invoiced: string | null;
        net_payable: string | null;
        to_party: unknown;
        amount_paid: string | null;
      }>;
      const now = Date.now();
      return {
        output: invoices.map((i) => {
          const paid = round2(Number(i.amount_paid ?? 0));
          const netPayable = Number(i.net_payable ?? 0);
          const outstanding = round2(netPayable - paid);
          const toParty = i.to_party as { name?: string | null } | null;
          return {
            id: i.id,
            number: i.number,
            vendor: i.vendor_name,
            billedTo: toParty?.name ?? null,
            type: i.invoice_type,
            status: i.status,
            currency: i.currency,
            issueDate: i.issue_date,
            dueDate: i.due_date,
            total: Number(i.total_invoiced ?? 0),
            amountPaid: paid,
            outstanding,
            isOverdue:
              Boolean(i.due_date) &&
              new Date(String(i.due_date)).getTime() < now &&
              outstanding > 0 &&
              i.status !== "Draft",
          };
        }),
      };
    }),

    tool(fn("get_budget", "Get the project's budget categories with allocated (planned), committed and actual/spent amounts plus variance and remaining per category, and overall totals. Use for questions about budget lines, cost codes, where money is over/under budget. get_finances is only the high-level summary."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const rows = await repo.budgetCategories(ctx.projectId);
      const categories = rows.map((c) => {
        const allocated = Number(c.planned ?? 0);
        const committed = Number(c.committed ?? 0);
        const spent = Number(c.actual ?? 0);
        return {
          name: c.name,
          costCode: c.cost_code,
          allocated,
          committed,
          spent,
          variance: round2(allocated - spent),
          remaining: round2(allocated - committed - spent),
          overBudget: spent > allocated,
        };
      });
      const sum = (pick: (c: (typeof categories)[number]) => number): number =>
        round2(categories.reduce((total, c) => total + pick(c), 0));
      return {
        output: {
          categories,
          totals: {
            allocated: sum((c) => c.allocated),
            committed: sum((c) => c.committed),
            spent: sum((c) => c.spent),
            variance: sum((c) => c.variance),
          },
        },
      };
    }),

    tool(fn("get_purchase_orders", "Get the project's purchase orders with vendor, status, committed total and expected delivery date. Use for questions about POs, what has been ordered from vendors, committed procurement spend, or expected deliveries."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const orders = await repo.purchaseOrders(ctx.projectId);
      return {
        output: orders.map((po) => ({
          id: po.id,
          poNumber: po.po_number,
          vendor: po.vendor_name,
          status: po.status,
          total: round2(Number(po.total ?? 0)),
          orderDate: po.order_date,
          expectedDelivery: po.expected_date,
        })),
      };
    }),

    tool(fn("get_payment_claims", "Get the project's payment claims (progress claims): claim number, workflow status (Draft/Submitted/Approved/Rejected/Paid), claimed and approved amounts, claim period and linked milestone. Use for questions about progress claims, what has been claimed or approved for payment."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const claims = await repo.paymentClaims(ctx.projectId);
      return {
        output: claims.map((c) => {
          const amount = Number(c.amount ?? 0);
          const approved = c.status === "Approved" || c.status === "Paid";
          return {
            id: c.id,
            claimNumber: c.claim_number,
            status: c.status,
            claimedAmount: amount,
            approvedAmount: approved ? amount : null,
            periodStart: c.period_start,
            periodEnd: c.period_end,
            submittedAt: c.submitted_at,
            approvedAt: c.approved_at,
            milestone: c.milestone_name ?? null,
          };
        }),
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

    tool(fn("get_boq_items", "Get Bill of Quantities (BoQ) line items from the accepted/converted proposal for this project, including description, group, quantity and unit. Use for BoQ quantity questions such as total doors, blocks, tiles, fixtures, or any 'how many/how much is in the BoQ' question. This is the planned BoQ, not procurement orders or live stock."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const items = await repo.boqItems(ctx.projectId);
      return {
        output: items.map((item) => ({
          proposalId: item.proposal_id,
          proposalTitle: item.proposal_title,
          proposalStatus: item.proposal_status,
          group: item.group_label,
          description: item.description,
          quantity: Number(item.qty ?? 0),
          unit: item.unit,
        })),
      };
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

    tool(fn("get_suppliers", "Get the project's supplier directory (name, contact person, email, phone, address). Use for questions about who supplies materials, supplier contact details, or which vendors are on file."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const suppliers = await repo.suppliers(ctx.projectId);
      return {
        output: suppliers.map((s) => ({
          name: s.name,
          contactName: s.contact_name,
          email: s.email,
          phone: s.phone,
          address: s.address,
        })),
      };
    }),

    tool(fn("get_tasks", "Get the project's task board (Kanban) with each task's column, assignee and due date. Use for questions about tasks, the board, what's in progress, what's assigned to someone, or what tasks are overdue."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const tasks = await repo.tasks(ctx.projectId);
      return {
        output: tasks.map((t) => ({
          title: t.title,
          column: t.columnName,
          assignee: t.assigneeUserName ?? t.assigneeTeamName ?? null,
          dueDate: t.due_date,
          overdue: Boolean(t.due_date) && new Date(t.due_date as string).getTime() < now && t.columnName !== "Done",
        })),
      };
    }),

    tool(fn("get_task_links", "Get cross-references between tasks and other project records (action items, RFIs, change requests, materials, invoices, milestone payments). Use when asked what a task is linked or related to, or what work connects to a specific RFI, change request, invoice or milestone."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const rows = await repo.taskEntityLinks(ctx.projectId);
      const byTask = new Map<string, { entityType: string; label: string }[]>();
      for (const row of rows as { taskTitle: string; entityType: string; label: string | null }[]) {
        const list = byTask.get(row.taskTitle) ?? [];
        list.push({ entityType: row.entityType, label: row.label ?? "(untitled)" });
        byTask.set(row.taskTitle, list);
      }
      return {
        output: [...byTask.entries()].map(([task, links]) => ({ task, linkedItems: links })),
      };
    }),

    tool(fn("get_task_comments", "Get the discussion/comments left on tasks — who said what and when. Use when asked about the conversation, notes, updates or discussion on a task, or what has been said about a specific piece of work."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const rows = (await repo.taskComments(ctx.projectId)) as {
        taskTitle: string;
        authorName: string;
        body: string;
        created_at: string;
      }[];
      const byTask = new Map<string, { author: string; body: string; at: string }[]>();
      for (const row of rows) {
        const list = byTask.get(row.taskTitle) ?? [];
        list.push({ author: row.authorName, body: row.body, at: row.created_at });
        byTask.set(row.taskTitle, list);
      }
      return {
        output: [...byTask.entries()].map(([task, comments]) => ({ task, comments })),
      };
    }),

    tool(fn("get_open_items", "Get the open items needing attention across RFIs, approvals, action items and site queries — anything unresolved with a status, owner and due date. Use for 'what needs my attention', 'what is blocking us', 'what is open or overdue', or 'what is pending sign-off'."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const overdue = (d: unknown): boolean => Boolean(d) && new Date(d as string).getTime() < now;
      const [rfis, approvals, actionItems, queries] = await Promise.all([
        repo.rfisOpen(ctx.projectId),
        repo.approvalsOpen(ctx.projectId),
        repo.actionItemsOpen(ctx.projectId),
        repo.queriesOpen(ctx.projectId),
      ]);
      return {
        output: {
          rfis: rfis.map((r) => ({ title: r.title, status: r.status, priority: r.priority, dueDate: r.due_date, overdue: overdue(r.due_date) })),
          approvals: approvals.map((a) => ({ title: a.title, category: a.category, status: a.status, submittedBy: a.submittedBy, dueDate: a.due_date, overdue: overdue(a.due_date) })),
          actionItems: actionItems.map((a) => ({ title: a.title, status: a.status, priority: a.priority, assignee: a.assignee, dueDate: a.due_date, overdue: overdue(a.due_date) })),
          queries: queries.map((q) => ({ title: q.title, status: q.status, assignee: q.assignee, dueDate: q.due_date, overdue: overdue(q.due_date) })),
        },
      };
    }),

    tool(fn("get_change_requests", "Get the project's change requests with their cost and schedule impact and decision status. Use for questions about changes, variations, scope changes, or why the budget or timeline is moving."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const changes = await repo.changeRequests(ctx.projectId);
      return {
        output: changes.map((c) => ({
          title: c.title,
          status: c.status,
          costImpact: c.cost_impact === null ? null : Number(c.cost_impact),
          scheduleImpactDays: c.time_impact_days === null ? null : Number(c.time_impact_days),
          currency: c.currency,
          reason: c.reason,
          decidedAt: c.decided_at,
          submittedBy: c.submittedBy,
        })),
      };
    }),

    tool(fn("get_selections", "Get the homeowner's finish/fixture selections (tile, taps, lighting…) with their allowance budget, deadline, decision status, the chosen option and its price, and any overage above the allowance. Use for questions about client selections, allowances, what the homeowner has chosen or still needs to choose, and selection overages."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const selections = (await repo.selections(ctx.projectId)) as Array<{
        id: string;
        title: string;
        category: string | null;
        status: string;
        allowance_amount: string | null;
        currency: string;
        due_date: string | null;
        decided_at: string | null;
        change_request_id: string | null;
        chosen_option_name: string | null;
        chosen_option_price: string | null;
      }>;
      return {
        output: selections.map((s) => {
          const allowance = s.allowance_amount === null ? null : Number(s.allowance_amount);
          const chosenPrice = s.chosen_option_price === null ? null : Number(s.chosen_option_price);
          const overage =
            allowance !== null && chosenPrice !== null
              ? Math.max(0, round2(chosenPrice - allowance))
              : null;
          return {
            title: s.title,
            category: s.category,
            status: s.status,
            allowance,
            currency: s.currency,
            chosenOption: s.chosen_option_name,
            chosenPrice,
            overage,
            dueDate: s.due_date,
            isOverdue:
              Boolean(s.due_date) &&
              new Date(String(s.due_date)).getTime() < now &&
              s.status === "open",
            decidedAt: s.decided_at,
            hasChangeRequest: s.change_request_id !== null,
          };
        }),
      };
    }),

    tool(fn("get_permits", "Get the project's permits with authority, status and key dates. Use for questions about permits, approvals to start work, regulatory status, or what is expiring."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const now = Date.now();
      const permits = await repo.permits(ctx.projectId);
      return {
        output: permits.map((p) => ({
          title: p.title,
          authority: p.authority,
          reference: p.reference_no,
          status: p.status,
          appliedDate: p.applied_date,
          approvedDate: p.approved_date,
          expiryDate: p.expiry_date,
          daysToExpiry: p.expiry_date ? Math.round((new Date(p.expiry_date as string).getTime() - now) / 86_400_000) : null,
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

    tool(fn("create_task", "Create a task on the project's task board (it goes to the first column, e.g. 'To Do'). ONLY call this when the user explicitly asks to create/add a task, and confirm the title and details with them first — never invent details they did not give. Returns the created task's id.", {
      title: { type: "string", description: "Short task title (required)" },
      description: { type: "string", description: "Optional longer description" },
      assigneeId: { type: "string", description: "Optional user id to assign — only if a user id is known; do not guess" },
      dueDate: { type: "string", description: "Optional due date, YYYY-MM-DD" },
    }, ["title"]), async (ctx, args) => {
      // Same check as POST /projects/:id/tasks (requireProjectWrite).
      assertCanModifyProject(ctx.caller.project, {
        userId: ctx.caller.user.id,
        orgRoles: ctx.caller.orgRoles,
      });
      const service = tasksService(tasksRepository(ctx.db), {
        notifications: notificationsService(notificationsRepository(ctx.db), ctx.queue),
      });
      const task = await service.createTask(
        ctx.projectId,
        {
          title: requiredString(args.title, 200, "title"),
          description: optionalString(args.description, 50000),
          assigneeId: optionalString(args.assigneeId, 100),
          dueDate: optionalString(args.dueDate, 40),
        },
        ctx.caller.user.id,
      );
      return {
        output: {
          created: true,
          id: task.id,
          title: task.title,
          assignee: task.assigneeName,
          dueDate: task.dueDate,
          page: `/project/${ctx.projectId}/tasks`,
        },
      };
    }),

    tool(fn("raise_query", "Raise a site query on the project on behalf of the user. ONLY call this when the user explicitly asks to raise/log a query, and confirm the subject and question with them first — never invent content. Returns the created query's id.", {
      subject: { type: "string", description: "Short query subject (required)" },
      question: { type: "string", description: "The question body (required)" },
    }, ["subject", "question"]), async (ctx, args) => {
      // Same check as POST /projects/:id/queries (staff with write access or client participant).
      assertCanActAsClient(ctx.caller.project, {
        userId: ctx.caller.user.id,
        orgRoles: ctx.caller.orgRoles,
        projectRoles: ctx.caller.projectRoles,
      });
      const service = queriesService(queriesRepository(ctx.db), {
        notifications: notificationsService(notificationsRepository(ctx.db), ctx.queue),
      });
      const query = await service.create(
        ctx.projectId,
        {
          subject: requiredString(args.subject, 200, "subject"),
          question: requiredString(args.question, 4000, "question"),
        },
        ctx.caller.user.id,
      );
      return {
        output: {
          created: true,
          id: query.id,
          subject: query.subject,
          status: query.status,
          page: `/project/${ctx.projectId}/queries`,
        },
      };
    }),

    tool(fn("create_rfi", "Draft an RFI (request for information) on the project, created in Draft status and attributed to the user, so they can review, assign and send it from the RFIs page. ONLY call this when the user explicitly asks to create/raise an RFI, and confirm the subject and question with them first — never invent content. Returns the created RFI's id and number.", {
      subject: { type: "string", description: "Short RFI subject (required)" },
      question: { type: "string", description: "The full question being asked (required)" },
    }, ["subject", "question"]), async (ctx, args) => {
      // Same check as POST /projects/:id/rfis (staff with write access or client participant).
      assertCanActAsClient(ctx.caller.project, {
        userId: ctx.caller.user.id,
        orgRoles: ctx.caller.orgRoles,
        projectRoles: ctx.caller.projectRoles,
      });
      const service = rfisService(rfisRepository(ctx.db), {
        notifications: notificationsService(notificationsRepository(ctx.db), ctx.queue),
      });
      const isClient = ctx.caller.projectRoles.get(ctx.projectId) === "client";
      // No ballInCourtId => the RFI starts in Draft (the earliest status).
      const rfi = await service.create(
        ctx.projectId,
        {
          subject: requiredString(args.subject, 200, "subject"),
          question: requiredString(args.question, 8000, "question"),
        },
        { id: ctx.caller.user.id, name: ctx.caller.user.name },
        isClient ? "shared" : "internal",
      );
      return {
        output: {
          created: true,
          id: rfi.id,
          number: rfi.number,
          subject: rfi.subject,
          status: rfi.status,
          page: `/project/${ctx.projectId}/rfis`,
        },
      };
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
