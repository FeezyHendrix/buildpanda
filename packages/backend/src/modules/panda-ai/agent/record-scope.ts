import { canRead } from "./tool-permissions.ts";
import type { ToolContext } from "./tool-context.ts";

export interface AgentRecordScope {
  taskReaderId: string | null | undefined;
  expenseReaderId: string | null | undefined;
}

export const NO_RECORD_ACCESS: AgentRecordScope = { taskReaderId: null, expenseReaderId: null };

export function agentRecordScope(ctx: ToolContext): AgentRecordScope {
  return {
    taskReaderId: canRead(ctx, "tasks", "viewAll") ? undefined : ctx.caller.user.id,
    expenseReaderId: canRead(ctx, "finances", "viewAllExpenses") ? undefined : ctx.caller.user.id,
  };
}

export const expenseScopeLabel = (ctx: ToolContext) => canRead(ctx, "finances", "viewAllExpenses")
  ? "All project expenses" : "Only expenses logged by the caller; these are not project-wide totals";
