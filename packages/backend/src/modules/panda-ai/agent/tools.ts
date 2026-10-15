import { financeTools } from "./finance-tools.ts";
import { updateTools } from "./update-tools.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";
import { programmeTools } from "./programme-tools.ts";
import { expensesTools } from "./expenses-tools.ts";
import { contractTools } from "./contract-tools.ts";
import { siteTools } from "./site-tools.ts";
import { materialsTools } from "./materials-tools.ts";
import { preconstructionTools } from "./preconstruction-tools.ts";
import { tasksTools } from "./tasks-tools.ts";
import { documentsTools } from "./documents-tools.ts";
export type { AgentCaller, ToolContext, ToolResult } from "./tool-context.ts";

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
  inspections: "inspections",
  approvals: "approvals",
  "change-requests": "change-requests",
  permits: "permits",
  finances: "finances",
  budget: "finances/budget",
  invoices: "finances/invoices",
  "milestone-payments": "finances/payments",
  "purchase-orders": "finances/purchase-orders",
  "payment-claims": "finances/payment-claims",
  contract: "finances/contract",
  "schedule-of-values": "finances/contract",
  transactions: "finances/transactions",
  advance: "finances/advance",
  retention: "finances/retention",
  "measured-work": "finances/measured-work",
  "final-account": "finances/final-account",
  tasks: "tasks",
  rfis: "rfis",
  documents: "documents",
  team: "team",
  settings: "settings",
};

export function buildTools(): AgentTool[] {
  return [
    ...programmeTools(),
    ...expensesTools(),
    ...contractTools(),
    ...siteTools(),
    ...materialsTools(),
    ...preconstructionTools(),
    ...tasksTools(),
    ...documentsTools(),
    ...financeTools(),

    ...updateTools(),

    tool(fn("navigate", "Point the user to a page in the app. Returns a navigation target the UI shows as a button. Use when the user asks to go somewhere or you reference a page they should open.", { target: { type: "string", description: `One of: ${Object.keys(NAV_TARGETS).join(", ")}` } }, ["target"]), async (ctx, args) => {
      const key = String(args.target ?? "").toLowerCase();
      const slug = NAV_TARGETS[key];
      if (!slug) return { output: { error: `Unknown target. Valid: ${Object.keys(NAV_TARGETS).join(", ")}` } };
      const path = `/project/${ctx.projectId}/${slug}`;
      return { output: { navigatedTo: path }, navigate: path };
    }),
  ];
}
