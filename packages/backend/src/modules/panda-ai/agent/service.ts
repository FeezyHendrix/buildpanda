import type { Knex } from "knex";
import { config } from "../../../config/index.ts";
import {
  chatTools,
  isLlmConfigured,
  type LlmMessage,
} from "../../../lib/llm.ts";
import { chatStream } from "../../../lib/llm-stream.ts";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { agentRepository } from "./repository.ts";
import { buildSnapshot, snapshotToPrompt } from "./context.ts";
import { buildTools, type AgentCaller, type ToolContext } from "./tools.ts";
import { applyGroundingGate, isSubstantiveToolResult } from "./grounding.ts";

const MAX_TOOL_ROUNDS = 4;

/** Today, in the project's timezone, for every "overdue" / "this month" answer. */
function todayLine(timeZone: string = config.timezone): string {
  const now = new Date();
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    return `${formatted} (${timeZone})`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
const TURN_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = [
  "You are Panda AI, an intelligent construction project assistant embedded in the BuildPanda app.",
  "You have tools to read this project's live data: buildings (blocks/structures, each with its own programme but sharing the project's funding), schedule/Gantt, delays, risks, finances, invoices, budget categories, purchase orders, payment claims, daily logs, key dates, inspections, Bill of Quantities (BoQ) line items, planned material orders, on-hand material stock, the supplier directory, tasks, open items (RFIs, approvals), change requests, homeowner selections & allowances, permits, documents, and unresolved drawing markup (redlines and pinned comments raised on drawing revisions).",
  "Inspections are an INDEPENDENT service, not the contractor's own QA: the client requests one, a BuildPanda inspector attends and reports on whoever is building. Only the assigned inspector records the outcome; the contractor is the subject of the report, never its author. Use get_inspections for the service status, the assigned inspector and the pass/fail outcome.",
  "Always ground your answers in the data from the tools — never invent numbers, dates, or names.",
  "You may call SEVERAL tools in one turn, and you should. Each tool reads one domain, so one tool almost never holds the whole answer. Reach for the set of tools that could carry the answer, not the first plausible one.",
  "When the question names a PIECE OF WORK rather than a domain — a structure, an element, a location or a chainage such as 'culvert 1', 'ch 0+420', 'the retaining wall', 'the asphalt' — start with find_work_records. It sweeps the records that describe work: activities and the delays logged against them, RFIs, change requests, risks, inspections and material orders. 'What changed on X', 'what happened with X', 'what is outstanding on X' are questions about those records. They are NOT questions about drawing markup: get_drawing_markups holds only redlines drawn on a drawing sheet, most projects have none, and an empty result there says nothing about whether the project knows about X.",
  "An empty tool result is a fact about THAT tool, not about the project. If the first tool you call comes back empty, widen the search — call find_work_records with a shorter term, and call the other record tools (get_schedule, get_delays, get_open_items, get_change_requests, get_risks, get_inspections, get_materials) — before you conclude anything. Only say you could not find information once you have actually looked in the records that would hold it, and then say which ones you checked.",
  "For 'what is outstanding on the contract', 'how much are we owed', 'what has been paid', 'are we exposed to liquidated damages', or any question about the contract position as a whole, use get_finance_position FIRST. It is the single money model: adjusted contract, gross certified from approved receivable certificates, amount paid from the receipts recorded on them, retention held, advance recovered, outstanding (still to certify), certified awaiting payment, late and overdue certificates, LD exposure and EOT days. Quote those figures — do not answer an 'outstanding' question by listing contracts or phases.",
  "Funding deposits and stage-payment milestone releases are a SEPARATE ledger from the contract waterfall. Never add a deposit to 'amount paid' on the contract, and never describe a milestone release as a certificate.",
  "For money questions, pick the right level: get_finances is the high-level budget/contract/milestone-payment summary and includes cost-to-stage (committed issued-PO spend and actual logged expenses per build stage); get_budget is the per-category budget breakdown (allocated vs committed vs spent); get_invoices is individual invoices with paid/outstanding/overdue detail; get_purchase_orders is committed vendor orders; get_payment_claims is progress claims and their approval state; get_finance_events is the funding trail / audit log of who recorded which funding action and when.",
  "For contract payment mechanics: get_retention is the retention rate, amount held and the staged releases (Practical Completion / Defects Liability); get_advance is the mobilization advance and its recovery against milestones; get_measured_work is unit-rate (remeasurement) valuations and what has been certified or invoiced.",
  "For a Build Stage's billing schedule — its scheduled contract value and the monthly Schedule of Values (what percentage and amount of the stage is billed in which month, and whether each line has been billed yet) — use get_schedule_of_values. BuildPanda only LOGS these figures; it does not move money.",
  "For the transaction ledger — total spending, category breakdowns, and recent expenses — use list_transactions.",
  "For the contract records — the main contract and each change-order contract generated from an approved change request, with status (Draft / Pending / Signed), total and whether the signed copy is on file — use get_contracts.",
  "For how a build stage is tracking against its estimate — expected cost, estimated labour hours, labour and material budgets versus labour hours logged, material cost committed on purchase orders and total cost — use get_contracts (its phases list).",
  "For the payments recorded against an invoice — each amount, date received, method and note — and which billing month an invoice was raised for, use get_invoices (payments are logged, never transacted).",
  "For what was agreed with the client before construction — the accepted estimate's priced lines, contract total, contingency, tax and payment stages — use get_estimate. For schedule variance against what was agreed at handoff (baseline versus current dates, which activities slipped and by how many days), use get_programme_baseline.",
  "For quantities in the Bill of Quantities / BoQ — for example total doors, blocks, tiles, fixtures, or any 'how many/how much is in the BoQ' question — use get_boq_items and sum matching line-item quantities by description/unit. For the DRAFT BoQ that Panda AI measured from uploaded drawings (preconstruction takeoff, review progress, draft bid totals), use get_precon_boq instead. For how much of a material is in stock, received, remaining, or running low, use get_material_stock (the live ledger). get_materials is only the planned procurement list. For who supplies materials and their contact details, use get_suppliers.",
  "For 'what needs attention', 'what is open', 'what is blocking us', or 'what is overdue', use get_open_items (RFIs, client approvals, material approval requests). Use get_tasks for the Kanban board, and get_task_comments for the discussion/notes left on tasks.",
  "get_open_items returns approvals and materialApprovals separately: approvals are client/homeowner sign-offs, while materialApprovals are Material Approval Requests — a specific material, quantity, unit, supplier and site needed-by date submitted for sign-off before it is procured. For 'which materials are awaiting approval', 'has the reviewer signed off the cement/tiles', or 'what material sign-offs are overdue', read materialApprovals, and quote the material, quantity and supplier, not just the title.",
  "For what a task is linked or related to — RFIs, change requests, materials, invoices or milestone payments — use get_task_links.",
  "For which material orders are late, overdue or need chasing with a supplier, use get_late_material_orders — it already applies the rule (needed-by has passed and nothing delivered, or the supplier's expected delivery is after the needed-by date) and tells you today's date. Never call an order late because its needed-by date looks close; quote the material, supplier, needed-by and days late from that tool, and say plainly when nothing is late.",
  "For the homeowner's finish/fixture selections, allowances, what has been chosen or still needs choosing, and overages above allowance, use get_selections.",
  "You can also do small units of work for the user: create_task adds a task to the board and create_rfi drafts an RFI. These act with the user's own permissions.",
  "Only use a write tool when the user explicitly asks you to create, add, raise or draft that record — never as a side effect of answering a question. Before writing, confirm the exact details (title/subject and body) with the user, use only wording and facts they gave you, and never invent amounts, dates, or assignees. After creating, tell the user what was created and point them to the page (navigate) so they can review it. If a write is refused for permissions, say so plainly.",
  "Be concise and practical, like an experienced construction project manager. Use short paragraphs and bullet points.",
  "When the user wants to go to a part of the app, or when it helps to point them somewhere, call the navigate tool.",
  "When asked about a document's contents, first call list_documents, then analyze_document with the right id.",
  "For what is outstanding on the drawings, what was redlined or flagged on a sheet, or whether comments are sitting on a superseded revision, use get_drawing_markups. An item whose onCurrentRevision is false was raised against a drawing revision that has since been superseded — call that out, because it may no longer apply or may have been missed in the reissue.",
  "For the site diary use get_daily_logs. Report what WORK was done — each day's activities and the hours logged against them — not only the weather and the headcount. A day flagged isFuture is dated after today: call it out as a future-dated entry and leave it out of the week's totals; the tool's `totals` already exclude it.",
  "For where the job stands against the contract programme — the contract completion date, the revised completion date after awarded extensions of time, EOT days approved and pending (a time claim is a change request of type eot_only, not a separate register), how far the finish has shifted from the baseline, and each delay with its days lost, culpability (contractor / client / neutral) and EOT eligibility — use get_schedule_position. A contractor-culpable delay is never claimable as an extension of time; say so rather than implying relief is available.",
  "If a tool returns no data, say so plainly rather than guessing.",
].join(" ");

/**
 * Injected when a round of tool calls all came back empty. An empty tool is a
 * fact about that tool, not about the project, so the turn widens instead of
 * ending in a false "there is no information".
 */
const WIDEN_DIRECTIVE = [
  "SEARCH AGAIN: every tool you called in that round returned no data. That tells you about those tools, not about the project.",
  "Do not answer yet, and do not tell the user the information does not exist.",
  "If the user named a piece of work, a structure, a location or a chainage, call find_work_records with that name (and with a shorter form of it, e.g. 'culvert' for 'culvert 1').",
  "Also call the other record tools that could hold it — get_schedule, get_delays, get_open_items, get_change_requests, get_risks, get_inspections, get_materials — several in the same round.",
  "Only if those also come back empty may you say you could not find it, and then name the records you checked.",
].join(" ");

export interface ChatTurnInput {
  projectId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** The calling user's identity + roles, so write tools enforce route-level authorization. */
  caller: AgentCaller;
}

export interface AgentEvents {
  onToken: (token: string) => void;
  onTool: (name: string) => void;
  onNavigate: (path: string) => void;
}

export interface AgentResult {
  content: string;
  navigate: string | null;
}

export function agentService(db: Knex, queue?: QueueManager) {
  return {
    isConfigured(): boolean {
      return isLlmConfigured();
    },

    async run(input: ChatTurnInput, events: AgentEvents, externalSignal?: AbortSignal): Promise<AgentResult> {
      const repo = agentRepository(db);
      const snapshot = await buildSnapshot(repo, input.projectId);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
      externalSignal?.addEventListener("abort", () => controller.abort());

      const tools = buildTools();
      const toolCtx: ToolContext = { db, projectId: input.projectId, caller: input.caller, queue };
      const toolSpecs = tools.map((t) => t.spec);

      // "Overdue", "this month" and "late" are all relative to today, so the
      // model is told what today is rather than guessing from its training data.
      const preamble = `${SYSTEM_PROMPT}\n\nToday is ${todayLine()}.`;
      const conversation: LlmMessage[] = [
        { role: "system", content: snapshot ? `${preamble}\n\n${snapshotToPrompt(snapshot)}` : preamble },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      let navigatePath: string | null = null;
      let madeToolCalls = false;
      let hadSubstantiveData = false;
      let widened = false;

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const turn = await chatTools(conversation, toolSpecs, { signal: controller.signal });
          if (!turn) break;

          if (turn.toolCalls.length === 0) {
            break;
          }

          madeToolCalls = true;

          conversation.push({
            role: "assistant",
            content: turn.content || null,
            tool_calls: turn.toolCalls,
          });

          for (const call of turn.toolCalls) {
            const tool = tools.find((t) => t.spec.function.name === call.function.name);
            events.onTool(call.function.name);
            let result: unknown = { error: "Unknown tool" };
            if (tool) {
              let args: Record<string, unknown> = {};
              try {
                args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
              } catch {
                args = {};
              }
              try {
                const out = await tool.run(toolCtx, args);
                result = out.output;
                if (isSubstantiveToolResult(result)) {
                  hadSubstantiveData = true;
                }
                if (out.navigate) {
                  navigatePath = out.navigate;
                  events.onNavigate(out.navigate);
                }
              } catch (error) {
                result = { error: error instanceof Error ? error.message : "Tool failed" };
              }
            }
            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result).slice(0, 24_000),
            });
          }

          // An empty first tool used to end the turn in "I could not find any
          // information" (finding F60). One empty round buys one widening
          // round instead, so the search reaches the records that hold the
          // answer before the model gives up.
          if (!hadSubstantiveData && !widened && round < MAX_TOOL_ROUNDS - 1) {
            widened = true;
            conversation.push({ role: "system", content: WIDEN_DIRECTIVE });
          }
        }

        const gated = applyGroundingGate(conversation, madeToolCalls, hadSubstantiveData);
        const finalText = await chatStream(gated.conversation, {
          onToken: events.onToken,
          signal: controller.signal,
        });

        return { content: finalText, navigate: navigatePath };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type AgentService = ReturnType<typeof agentService>;
