import type { Knex } from "knex";
import {
  chatTools,
  chatStream,
  isLlmConfigured,
  type LlmMessage,
} from "../../../lib/llm.ts";
import { agentRepository } from "./repository.ts";
import { buildSnapshot, snapshotToPrompt } from "./context.ts";
import { buildTools, type ToolContext } from "./tools.ts";

const MAX_TOOL_ROUNDS = 4;
const TURN_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = [
  "You are Panda AI, an intelligent construction project assistant embedded in the BuildPanda app.",
  "You have tools to read this project's live data: schedule/Gantt, delays, risks, finances, daily logs, key dates, inspections, planned material orders, on-hand material stock, and documents.",
  "Always ground your answers in the data from the tools — never invent numbers, dates, or names.",
  "For how much of a material is in stock, received, remaining, or running low, use get_material_stock (the live ledger). get_materials is only the planned procurement list.",
  "Be concise and practical, like an experienced construction project manager. Use short paragraphs and bullet points.",
  "When the user wants to go to a part of the app, or when it helps to point them somewhere, call the navigate tool.",
  "When asked about a document's contents, first call list_documents, then analyze_document with the right id.",
  "If a tool returns no data, say so plainly rather than guessing.",
].join(" ");

export interface ChatTurnInput {
  projectId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
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

export function agentService(db: Knex) {
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
      const toolCtx: ToolContext = { db, projectId: input.projectId };
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
