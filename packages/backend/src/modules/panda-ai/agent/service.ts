import type { Knex } from "knex";
import {
  chatTools,
  chatStream,
  isLlmConfigured,
  type LlmMessage,
} from "../../../lib/llm.ts";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { agentRepository } from "./repository.ts";
import { buildSnapshot, snapshotToPrompt } from "./context.ts";
import { buildTools, type AgentCaller, type ToolContext } from "./tools.ts";

const MAX_TOOL_ROUNDS = 4;
const TURN_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = [
  "You are Panda AI, an intelligent construction project assistant embedded in the BuildPanda app.",
  "You have tools to read this project's live data: schedule/Gantt, delays, risks, finances, invoices, budget categories, purchase orders, payment claims, daily logs, key dates, inspections, planned material orders, on-hand material stock, the supplier directory, tasks, open items (RFIs, approvals, action items, queries), change requests, homeowner selections & allowances, permits, and documents.",
  "Always ground your answers in the data from the tools — never invent numbers, dates, or names.",
  "For money questions, pick the right level: get_finances is the high-level budget/escrow/milestone-payment summary; get_budget is the per-category budget breakdown (allocated vs committed vs spent); get_invoices is individual invoices with paid/outstanding/overdue detail; get_purchase_orders is committed vendor orders; get_payment_claims is progress claims and their approval state.",
  "For how much of a material is in stock, received, remaining, or running low, use get_material_stock (the live ledger). get_materials is only the planned procurement list. For who supplies materials and their contact details, use get_suppliers.",
  "For 'what needs attention', 'what is open', 'what is blocking us', or 'what is overdue', use get_open_items (RFIs, approvals, action items, queries). Use get_tasks for the Kanban board.",
  "For what a task is linked or related to — action items, RFIs, change requests, materials, invoices or milestone payments — use get_task_links.",
  "For the homeowner's finish/fixture selections, allowances, what has been chosen or still needs choosing, and overages above allowance, use get_selections.",
  "You can also do small units of work for the user: create_task adds a task to the board, raise_query raises a site query, and create_rfi drafts an RFI. These act with the user's own permissions.",
  "Only use a write tool when the user explicitly asks you to create, add, raise or draft that record — never as a side effect of answering a question. Before writing, confirm the exact details (title/subject and body) with the user, use only wording and facts they gave you, and never invent amounts, dates, or assignees. After creating, tell the user what was created and point them to the page (navigate) so they can review it. If a write is refused for permissions, say so plainly.",
  "Be concise and practical, like an experienced construction project manager. Use short paragraphs and bullet points.",
  "When the user wants to go to a part of the app, or when it helps to point them somewhere, call the navigate tool.",
  "When asked about a document's contents, first call list_documents, then analyze_document with the right id.",
  "If a tool returns no data, say so plainly rather than guessing.",
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

      const conversation: LlmMessage[] = [
        { role: "system", content: snapshot ? `${SYSTEM_PROMPT}\n\n${snapshotToPrompt(snapshot)}` : SYSTEM_PROMPT },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      let navigatePath: string | null = null;

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const turn = await chatTools(conversation, toolSpecs, { signal: controller.signal });
          if (!turn) break;

          if (turn.toolCalls.length === 0) {
            break;
          }

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
        }

        const finalText = await chatStream(conversation, {
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
