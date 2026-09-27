import {
  assertProjectPermission,
  canProjectPermission,
  type EnrichedAccessContext,
} from "../../../lib/authorization.ts";
import { ForbiddenError } from "../../../lib/errors.ts";
import type { AgentTool, ToolPermission } from "./tool-helpers.ts";
import type { ToolContext } from "./tools.ts";

/**
 * Which resource/action every agent tool needs, mirroring the HTTP route that
 * serves the same data.
 *
 * The assistant is not a second, softer door onto the project. `accountType` is
 * self-declared and grants nothing; only org membership and project
 * participation do, so each tool re-runs the exact check its route runs. A
 * client-side participant holding `finances:view` reads the certified contract
 * position and never the contractor's cost position (`finances:viewCosts`) —
 * through the API or through Panda AI.
 *
 * `null` means the tool reads no project data of its own: `navigate` returns a
 * path, and the two sweep tools gate each domain they touch individually (see
 * sectionsFor callers in tools.ts). Every other tool MUST have an entry —
 * `permissionFor` denies an unknown name, so a tool added without a policy is
 * withheld rather than silently readable by anyone.
 */
export const TOOL_PERMISSIONS: Record<string, ToolPermission | null> = {
  // Composite sweeps — gated per domain inside the tool.
  find_work_records: null,
  get_open_items: null,
  navigate: null,

  // Programme
  get_schedule: { resource: "schedule", action: "view" },
  get_delays: { resource: "schedule", action: "view" },
  get_schedule_position: { resource: "schedule", action: "view" },
  get_programme_baseline: { resource: "schedule", action: "view" },
  get_buildings: { resource: "buildings", action: "view" },
  get_key_dates: { resource: "key-dates", action: "view" },
  get_schedule_of_values: { resource: "stages", action: "view" },

  // Money the employer sees: the certified contract position.
  get_finances: { resource: "finances", action: "view" },
  get_finance_position: { resource: "finances", action: "view" },
  get_finance_events: { resource: "finances", action: "view" },
  get_contracts: { resource: "finances", action: "view" },
  get_invoices: { resource: "finances", action: "view" },
  get_payment_claims: { resource: "finances", action: "view" },
  get_retention: { resource: "finances", action: "view" },
  get_advance: { resource: "finances", action: "view" },
  get_measured_work: { resource: "finances", action: "view" },

  // Money only the contractor sees: spend, commitments, budget vs actual.
  get_budget: { resource: "finances", action: "viewCosts" },
  get_purchase_orders: { resource: "finances", action: "viewCosts" },
  list_transactions: { resource: "finances", action: "viewCosts" },
  get_transaction_summary: { resource: "finances", action: "viewCosts" },

  // Site records
  get_daily_logs: { resource: "dailyLog", action: "view" },
  get_inspections: { resource: "inspections", action: "view" },
  get_risks: { resource: "risks", action: "view" },
  get_permits: { resource: "permits", action: "view" },
  get_change_requests: { resource: "change-requests", action: "view" },
  get_selections: { resource: "selections", action: "view" },

  // Materials
  get_materials: { resource: "materials", action: "view" },
  get_late_material_orders: { resource: "materials", action: "view" },
  get_material_stock: { resource: "materials", action: "view" },
  get_material_ledger: { resource: "materials", action: "view" },
  get_suppliers: { resource: "materials", action: "view" },

  // Tasks
  get_tasks: { resource: "tasks", action: "view" },
  get_task_links: { resource: "tasks", action: "view" },
  get_task_comments: { resource: "tasks", action: "view" },

  // Documents & drawings
  list_documents: { resource: "documents", action: "view" },
  analyze_document: { resource: "documents", action: "view" },
  analyze_drawing: { resource: "documents", action: "view" },
  get_drawing_markups: { resource: "documents", action: "view" },

  // Pre-construction: org-level grants, exactly as the precon routes require.
  get_estimate: { resource: "estimates", action: "view" },
  get_boq_items: { resource: "proposals", action: "view" },
  get_precon_boq: { resource: "takeoffs", action: "view" },

  // Writes — the same checks POST /tasks and POST /rfis run.
  create_task: { resource: "tasks", action: "add" },
  create_rfi: { resource: "rfis", action: "create" },
};

/** Deny by default: a tool with no policy entry is not readable by anyone. */
export function permissionFor(name: string): ToolPermission | null | undefined {
  return Object.hasOwn(TOOL_PERMISSIONS, name) ? TOOL_PERMISSIONS[name] : undefined;
}

export function callerAccessContext(ctx: ToolContext): EnrichedAccessContext {
  return {
    userId: ctx.caller.user.id,
    orgRoles: ctx.caller.orgRoles,
    projectRoles: ctx.caller.projectRoles,
    orgPermissions: ctx.caller.orgPermissions,
    projectSectionPermissions: ctx.caller.projectSectionPermissions,
    projectGrants: ctx.caller.projectGrants,
  };
}

/** May the caller read this resource/action on this project? */
export function canRead(ctx: ToolContext, resource: string, action: string): boolean {
  return canProjectPermission(ctx.caller.project, callerAccessContext(ctx), resource, action);
}

/**
 * Wraps every tool's run with its permission check and drops the ones the
 * caller may not use. Withholding keeps a forbidden domain out of the tool
 * list entirely; the wrapper is the belt to that braces, so a tool reached any
 * other way still refuses instead of returning data.
 */
export function toolsForCaller(tools: AgentTool[], ctx: ToolContext): AgentTool[] {
  const allowed: AgentTool[] = [];
  for (const entry of tools) {
    const name = entry.spec.function.name;
    const permission = permissionFor(name);
    if (permission === undefined) continue; // unknown tool: fail closed
    if (permission === null) {
      allowed.push(entry);
      continue;
    }
    if (!canRead(ctx, permission.resource, permission.action)) continue;
    allowed.push({
      spec: entry.spec,
      // async so a refusal is always a rejected promise, never a synchronous
      // throw the caller has to guard separately.
      run: async (runCtx, args) => {
        assertProjectPermission(
          runCtx.caller.project,
          callerAccessContext(runCtx),
          permission.resource,
          permission.action,
        );
        return entry.run(runCtx, args);
      },
    });
  }
  return allowed;
}

/**
 * For the sweep tools, which read several domains at once: the sections the
 * caller may see. Refuses outright when none of them are readable, so the
 * assistant never answers from a partial sweep that reads like a whole one.
 */
export function readableSections<T extends string>(
  ctx: ToolContext,
  sections: ReadonlyArray<{ key: T; resource: string; action: string }>,
): { allowed: T[]; withheld: T[] } {
  const allowed: T[] = [];
  const withheld: T[] = [];
  for (const section of sections) {
    if (canRead(ctx, section.resource, section.action)) allowed.push(section.key);
    else withheld.push(section.key);
  }
  if (allowed.length === 0) {
    throw new ForbiddenError("Your role does not allow you to view any of these records");
  }
  return { allowed, withheld };
}
