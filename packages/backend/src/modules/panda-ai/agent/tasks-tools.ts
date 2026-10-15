import { agentRecordScope } from "./record-scope.ts";
import { tasksRepository } from "../../tasks/repository.ts";
import { tasksService } from "../../tasks/service.ts";
import { notificationsRepository } from "../../notifications/repository.ts";
import { notificationsService } from "../../notifications/service.ts";
import { agentRepository } from "./repository.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";
import { optionalString, requiredString } from "./tool-input.ts";
import { canRead } from "./tool-permissions.ts";

export function tasksTools(): AgentTool[] {
  return [
    tool(fn("get_tasks", "Get the project's task board (Kanban) with each task's column, assignee and due date. Use for questions about tasks, the board, what's in progress, what's assigned to someone, or what tasks are overdue."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
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

    tool(fn("get_task_links", "Get cross-references between tasks and other project records (RFIs, change requests, materials, invoices, milestone payments). Use when asked what a task is linked or related to, or what work connects to a specific RFI, change request, invoice or milestone."), async (ctx) => {
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
      const allowedTypes = [["rfi", "rfis", "view"], ["change_request", "change-requests", "view"],
        ["material", "materials", "view"], ["invoice", "finances", "viewCosts"], ["milestone_payment", "finances", "view"]] as const;
      const internal = ctx.caller.project.ownerId === ctx.caller.user.id ||
        !!(ctx.caller.project.organizationId && ctx.caller.orgRoles.has(ctx.caller.project.organizationId));
      const rows = await repo.taskEntityLinks(ctx.projectId,
        allowedTypes.filter(([, resource, action]) => canRead(ctx, resource, action)).map(([type]) => type), internal);
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
      const repo = agentRepository(ctx.db, agentRecordScope(ctx));
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

    tool(fn("create_task", "Create a task on the project's task board (it goes to the first column, e.g. 'To Do'). ONLY call this when the user explicitly asks to create/add a task, and confirm the title and details with them first — never invent details they did not give. Returns the created task's id.", {
      title: { type: "string", description: "Short task title (required)" },
      description: { type: "string", description: "Optional longer description" },
      assigneeId: { type: "string", description: "Optional user id to assign — only if a user id is known; do not guess" },
      dueDate: { type: "string", description: "Optional due date, YYYY-MM-DD" },
    }, ["title"]), async (ctx, args) => {
      // tasks:add — the same check POST /projects/:id/tasks runs — is applied
      // by toolsForCaller before this body is reached (see tool-permissions.ts).
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
  ];
}
