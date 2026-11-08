import { rfiListRepository } from "../../rfis/list-repository.ts";
import { rfiListService } from "../../rfis/list-service.ts";
import { rfisRepository } from "../../rfis/repository.ts";
import { RFI_PRIORITIES, RFI_STATUSES, type RfiListQuery, type RfiPriority, type RfiStatus } from "../../rfis/types.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  const list = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(String).filter((v): v is T => (allowed as readonly string[]).includes(v));
  return list.length ? list : undefined;
}

export function rfiTools(): AgentTool[] {
  return [
    tool(
      fn(
        "get_rfis",
        "Search the project's RFI register with the same filters the RFI page offers: status, priority, overdue only, a due-date range and a keyword (an RFI number such as 'RFI-3' works). Returns each RFI's number, subject, status, priority, who it is with, due date, isOverdue / overdueDays (project timezone) and response count, plus the register counts (all, open, answered, closed, overdue). Use for 'which high-priority RFIs are overdue', 'what is RFI 12 about', 'what is with the architect', 'how many RFIs are open'. For 'what needs attention' across every domain use get_open_items instead.",
        {
          q: { type: "string", description: "Keyword or RFI number" },
          status: { type: "array", items: { type: "string", enum: RFI_STATUSES } },
          priority: { type: "array", items: { type: "string", enum: RFI_PRIORITIES }, description: "Low, Normal (shown as Medium) or High" },
          overdue: { type: "boolean", description: "Only RFIs past their due date and still unanswered" },
          dueFrom: { type: "string", description: "yyyy-mm-dd, on the due date" },
          dueTo: { type: "string", description: "yyyy-mm-dd, on the due date" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
      ),
      async (ctx, args) => {
        const rfis = rfisRepository(ctx.db);
        const service = rfiListService(rfiListRepository(ctx.db, rfis), rfis);
        const query: RfiListQuery = {
          q: typeof args.q === "string" && args.q.trim() ? args.q.trim().slice(0, 200) : undefined,
          status: pick<RfiStatus>(args.status, RFI_STATUSES),
          priority: pick<RfiPriority>(args.priority, RFI_PRIORITIES),
          overdue: args.overdue === true,
          dueFrom: typeof args.dueFrom === "string" && DAY.test(args.dueFrom) ? args.dueFrom : undefined,
          dueTo: typeof args.dueTo === "string" && DAY.test(args.dueTo) ? args.dueTo : undefined,
          pageSize: typeof args.limit === "number" ? Math.min(50, Math.max(1, args.limit)) : 25,
          sort: args.overdue === true ? "dueDate" : "number",
        };
        const { project, orgRoles, user } = ctx.caller;
        const company = project.ownerId === user.id || Boolean(project.organizationId && orgRoles.has(project.organizationId));
        const page = await service.page(ctx.projectId, query, company);
        return {
          output: {
            counts: page.counts,
            matched: page.total,
            rfis: page.items.map((r) => ({
              number: `RFI-${r.number}`,
              subject: r.subject,
              status: r.status,
              priority: r.priority === "Normal" ? "Medium" : r.priority,
              with: r.ballInCourtName,
              dueDate: r.dueDate,
              isOverdue: r.isOverdue,
              overdueDays: r.overdueDays,
              responses: r.responseCount,
              raisedBy: r.createdByName,
            })),
          },
        };
      },
    ),
  ];
}
