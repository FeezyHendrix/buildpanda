import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const DECISION_CHASING_QUEUE = "decision-chasing-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;

// Escalation ladder — items WITH a due date step on it, items WITHOUT one
// step on how long they have been pending. Each level fires at most once
// per item (reminder_level persists the highest level already sent).
const HEADS_UP_WINDOW_DAYS = 3; // level 1: due within 3 days
const ESCALATE_OVERDUE_DAYS = 3; // level 3: 3+ days past due
const NO_DUE_HEADS_UP_DAYS = 5; // level 1: pending 5+ days
const NO_DUE_DUE_DAYS = 10; // level 2: pending 10+ days
const NO_DUE_ESCALATE_DAYS = 14; // level 3: pending 14+ days

const DAY_MS = 86_400_000;

export interface DecisionChasingJobData {
  _tick: number;
}

type DecisionKind = "approval" | "selection" | "query";

interface PendingDecisionRow {
  id: string;
  project_id: string;
  title: string;
  due_date: Date | string | null;
  created_at: Date | string;
  reminder_level: number | null;
}

interface PendingDecision extends PendingDecisionRow {
  kind: DecisionKind;
  table: string;
}

interface ProjectRow {
  id: string;
  name: string;
  owner_id: string | null;
  organization_id: string | null;
}

interface ParticipantRow {
  project_id: string;
  user_id: string;
}

interface OrgAdminRow {
  organizationId: string;
  userId: string;
}

export interface DecisionChasingSweepResult {
  pending: number;
  headsUp: number;
  due: number;
  escalated: number;
  errored: number;
}

function isoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
}

/** Highest ladder level the item qualifies for today (0 = none yet). */
function targetLevel(item: PendingDecisionRow, today: string): 0 | 1 | 2 | 3 {
  if (item.due_date !== null) {
    const overdueDays = daysBetween(isoDate(item.due_date), today);
    if (overdueDays >= ESCALATE_OVERDUE_DAYS) return 3;
    if (overdueDays >= 0) return 2;
    if (overdueDays >= -HEADS_UP_WINDOW_DAYS) return 1;
    return 0;
  }
  const pendingDays = daysBetween(isoDate(item.created_at), today);
  if (pendingDays >= NO_DUE_ESCALATE_DAYS) return 3;
  if (pendingDays >= NO_DUE_DUE_DAYS) return 2;
  if (pendingDays >= NO_DUE_HEADS_UP_DAYS) return 1;
  return 0;
}

/** Days the item has sat waiting: past-due days when dated, age when not. */
function waitingDays(item: PendingDecisionRow, today: string): number {
  const from = item.due_date !== null ? isoDate(item.due_date) : isoDate(item.created_at);
  return Math.max(0, daysBetween(from, today));
}

function clientMessage(
  item: PendingDecision,
  projectName: string,
  level: 1 | 2 | 3,
  today: string,
): { title: string; body: string } {
  const kind = item.kind;
  const name = item.title;
  if (level === 1) {
    const dueLine =
      item.due_date !== null
        ? `is due by ${isoDate(item.due_date)}`
        : `has been waiting for ${waitingDays(item, today)} days`;
    return {
      title: `Decision needed soon: ${name}`,
      body: `The ${kind} "${name}" on ${projectName} ${dueLine}. Making your choice now keeps the build moving.`,
    };
  }
  if (level === 2) {
    const dueLine =
      item.due_date !== null
        ? `is now due (due date ${isoDate(item.due_date)})`
        : `has been waiting for ${waitingDays(item, today)} days`;
    return {
      title: `Decision due: ${name}`,
      body: `The ${kind} "${name}" on ${projectName} ${dueLine}. The team needs your decision to keep work on schedule.`,
    };
  }
  const days = waitingDays(item, today);
  const dueLine =
    item.due_date !== null
      ? `is now ${days} days past its due date (${isoDate(item.due_date)})`
      : `has been waiting for ${days} days`;
  return {
    title: `Overdue decision: ${name}`,
    body: `The ${kind} "${name}" on ${projectName} ${dueLine}. Work may be held up until you decide — please choose as soon as you can.`,
  };
}

function builderMessage(
  item: PendingDecision,
  projectName: string,
  today: string,
): { title: string; body: string } {
  const days = waitingDays(item, today);
  const dueSuffix = item.due_date !== null ? ` (due ${isoDate(item.due_date)})` : "";
  return {
    title: `Awaiting client decision: ${item.title}`,
    body: `The client has not decided on the ${item.kind} "${item.title}" on ${projectName} for ${days} days${dueSuffix}. The client participants have been reminded; you may want to follow up directly.`,
  };
}

const PENDING_COLUMNS = [
  "id",
  "project_id",
  "due_date",
  "created_at",
  "reminder_level",
] as const;

/** One batched query per decision-bearing domain; only still-pending items. */
async function loadPendingDecisions(db: Knex): Promise<PendingDecision[]> {
  const [approvals, selections, queries] = await Promise.all([
    db("approvals")
      .where({ status: "Pending" })
      .where((b) => b.whereNull("reminder_level").orWhere("reminder_level", "<", 3))
      .select<PendingDecisionRow[]>(...PENDING_COLUMNS, "title"),
    db("project_selections")
      .where({ status: "open" })
      .where((b) => b.whereNull("reminder_level").orWhere("reminder_level", "<", 3))
      .select<PendingDecisionRow[]>(...PENDING_COLUMNS, "title"),
    // Queries are only a *client* decision when the responder (assignee) is an
    // active client participant — chase those, leave internal queries alone.
    db("queries as q")
      .where("q.status", "Open")
      .where((b) => b.whereNull("q.reminder_level").orWhere("q.reminder_level", "<", 3))
      .whereExists(
        db("project_participants as pp")
          .whereRaw("pp.project_id = q.project_id")
          .whereRaw("pp.user_id = q.assignee_id")
          .where({ "pp.role": "client", "pp.status": "active" }),
      )
      .select<PendingDecisionRow[]>(
        "q.id",
        "q.project_id",
        "q.subject as title",
        "q.due_date",
        "q.created_at",
        "q.reminder_level",
      ),
  ]);

  return [
    ...approvals.map((r) => ({ ...r, kind: "approval" as const, table: "approvals" })),
    ...selections.map((r) => ({ ...r, kind: "selection" as const, table: "project_selections" })),
    ...queries.map((r) => ({ ...r, kind: "query" as const, table: "queries" })),
  ];
}

export async function runDecisionChasingSweep(
  db: Knex,
  logger: FastifyBaseLogger,
  queue?: QueueManager,
): Promise<DecisionChasingSweepResult> {
  const notifications = notificationsService(notificationsRepository(db), queue);
  const today = new Date().toISOString().slice(0, 10);

  const pending = await loadPendingDecisions(db);
  const actionable = pending.filter((item) => targetLevel(item, today) > (item.reminder_level ?? 0));

  const result: DecisionChasingSweepResult = {
    pending: pending.length,
    headsUp: 0,
    due: 0,
    escalated: 0,
    errored: 0,
  };
  if (actionable.length === 0) {
    logger.info({ queue: DECISION_CHASING_QUEUE, ...result }, "decision chasing sweep complete");
    return result;
  }

  // Batched recipient resolution: client participants + project/company side.
  const projectIds = [...new Set(actionable.map((i) => i.project_id))];
  const [participants, projects] = await Promise.all([
    db<ParticipantRow>("project_participants")
      .whereIn("project_id", projectIds)
      .where({ role: "client", status: "active" })
      .whereNotNull("user_id")
      .select("project_id", "user_id"),
    db<ProjectRow>("projects")
      .whereIn("id", projectIds)
      .select("id", "name", "owner_id", "organization_id"),
  ]);

  const clientsByProject = new Map<string, string[]>();
  for (const row of participants) {
    const list = clientsByProject.get(row.project_id) ?? [];
    list.push(row.user_id);
    clientsByProject.set(row.project_id, list);
  }
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const orgIds = [...new Set(projects.flatMap((p) => (p.organization_id ? [p.organization_id] : [])))];
  const adminRows = orgIds.length
    ? await db<OrgAdminRow>("member")
        .whereIn("organizationId", orgIds)
        .whereIn("role", ["owner", "admin"])
        .select("organizationId", "userId")
    : [];
  const adminsByOrg = new Map<string, string[]>();
  for (const row of adminRows) {
    const list = adminsByOrg.get(row.organizationId) ?? [];
    list.push(row.userId);
    adminsByOrg.set(row.organizationId, list);
  }

  for (const item of actionable) {
    try {
      const level = targetLevel(item, today) as 1 | 2 | 3;
      const project = projectById.get(item.project_id);
      const projectName = project?.name ?? "your project";

      const msg = clientMessage(item, projectName, level, today);
      for (const userId of clientsByProject.get(item.project_id) ?? []) {
        await notifications.notify(userId, "decision_reminder", {
          title: msg.title,
          body: msg.body,
          projectId: item.project_id,
        });
      }

      if (level === 3) {
        const companySide = new Set<string>();
        if (project?.owner_id) companySide.add(project.owner_id);
        for (const userId of adminsByOrg.get(project?.organization_id ?? "") ?? []) {
          companySide.add(userId);
        }
        const escalation = builderMessage(item, projectName, today);
        for (const userId of companySide) {
          await notifications.notify(userId, "decision_escalated", {
            title: escalation.title,
            body: escalation.body,
            projectId: item.project_id,
          });
        }
      }

      await db(item.table)
        .where({ id: item.id })
        .update({ reminder_level: level, last_reminded_at: new Date() });

      if (level === 1) result.headsUp += 1;
      else if (level === 2) result.due += 1;
      else result.escalated += 1;
    } catch (error) {
      result.errored += 1;
      logger.error(
        { err: error, itemId: item.id, kind: item.kind, queue: DECISION_CHASING_QUEUE },
        "decision chasing reminder failed",
      );
    }
  }

  logger.info({ queue: DECISION_CHASING_QUEUE, ...result }, "decision chasing sweep complete");
  return result;
}

export function registerDecisionChasingWorker(
  db: Knex,
  manager: QueueManager,
  logger: FastifyBaseLogger,
): void {
  manager.startRepeating<DecisionChasingJobData>(
    DECISION_CHASING_QUEUE,
    INTERVAL_MS,
    () => runDecisionChasingSweep(db, logger, manager).then(() => undefined),
    { _tick: 0 },
  );
}
