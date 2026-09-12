import type { LlmTool } from "../../../lib/llm.ts";
import type { ToolContext, ToolResult } from "./tools.ts";

export interface AgentTool {
  spec: LlmTool;
  run(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}

export function tool(spec: LlmTool, run: AgentTool["run"]): AgentTool {
  return { spec, run };
}

export function fn(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): LlmTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required, additionalProperties: false },
    },
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
