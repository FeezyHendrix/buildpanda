import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { randomBytes, createHash } from "node:crypto";
import type { NotificationsService } from "../notifications/service.ts";
import type { RfisRepository, RfiUpdatePatch } from "./repository.ts";
import type {
  Rfi,
  RfiComment,
  RfiCommentAttachment,
  RfiCommentReference,
  RfiCommentRow,
  RfiDetail,
  RfiDistributionMember,
  RfiDistributionRole,
  RfiDistributionRow,
  RfiEvent,
  RfiEventRow,
  RfiPriority,
  RfiRow,
  RfiStatus,
  RfiVisibility,
} from "./types.ts";

export function hashReplyToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface CreateRfiInput {
  subject: string;
  question: string;
  priority?: RfiPriority;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
  assigneeRole?: string | null;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
}

export interface UpdateRfiInput {
  subject?: string;
  question?: string;
  priority?: RfiPriority;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
  assigneeRole?: string | null;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
}

export interface RespondInput {
  body: string;
  official?: boolean;
  contentHtml?: string | null;
  attachments?: RfiCommentAttachment[];
  references?: RfiCommentReference[];
}

export interface Actor {
  id: string;
  name: string;
}

function toRfi(row: RfiRow, commentCount: number): Rfi {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    subject: row.subject,
    question: row.question,
    status: row.status,
    priority: row.priority,
    visibility: row.visibility,
    ballInCourtId: row.ball_in_court_id,
    ballInCourtName: row.ball_in_court_name,
    ballInCourtEmail: row.ball_in_court_email,
    assigneeRole: row.assignee_role,
    dueDate: row.due_date,
    officialResponse: row.official_response,
    officialRespondedById: row.official_responded_by_id,
    officialRespondedByName: row.official_responded_by_name,
    officialRespondedAt: row.official_responded_at,
    costImpact: row.cost_impact,
    scheduleImpact: row.schedule_impact,
    changeRequestId: row.change_request_id,
    reopenedCount: row.reopened_count,
    createdById: row.created_by_id,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toComment(row: RfiCommentRow): RfiComment {
  return {
    id: row.id,
    rfiId: row.rfi_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    contentHtml: row.content_html,
    attachments: parseJsonArray<RfiCommentAttachment>(row.attachments),
    references: parseJsonArray<RfiCommentReference>(row.references),
    isProposedResponse: row.is_proposed_response,
    createdAt: row.created_at,
  };
}

function toEvent(row: RfiEventRow): RfiEvent {
  return {
    id: row.id,
    rfiId: row.rfi_id,
    type: row.type,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

function toDistribution(row: RfiDistributionRow): RfiDistributionMember {
  return {
    id: row.id,
    rfiId: row.rfi_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    external: row.user_id === null,
    tokenConsumedAt: row.token_consumed_at,
    createdAt: row.created_at,
  };
}

export interface DistributionInput {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role?: RfiDistributionRole;
}

export interface ExternalReplyResult {
  ok: boolean;
  rfiSubject: string;
  rfiNumber: number;
  reason?: "not_found" | "expired" | "consumed";
}

export interface ChangeRequestCreator {
  create(
    projectId: string,
    input: { title: string; description?: string | null; costImpact?: number; timeImpactDays?: number },
    userId: string,
  ): Promise<{ id: string }>;
}

const REOPENABLE: ReadonlySet<RfiStatus> = new Set(["Answered", "Closed"]);

export function rfisService(
  repository: RfisRepository,
  deps: { changeRequests?: ChangeRequestCreator; notifications?: NotificationsService } = {},
) {
  function notifyRfiAssignee(
    assigneeId: string | null | undefined,
    projectId: string,
    subject: string,
    actorId: string,
  ): void {
    if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
    void deps.notifications
      .notify(assigneeId, "rfi_assigned", {
        title: "An RFI was assigned to you",
        body: subject,
        projectId,
      })
      .catch(() => undefined);
  }

  async function logEvent(
    rfiId: string,
    type: string,
    actor: Actor | null,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await repository.addEvent({
      id: generateId("rfev"),
      rfi_id: rfiId,
      type,
      actor_id: actor?.id ?? null,
      actor_label: actor?.name ?? null,
      detail: detail ?? null,
    });
  }

  async function loadRow(projectId: string, rfiId: string): Promise<RfiRow> {
    const row = await repository.findById(rfiId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("RFI");
    return row;
  }

  return {
    async list(
      projectId: string,
      filter: { status?: RfiStatus; ballInCourtId?: string; sharedOnly?: boolean },
    ): Promise<Rfi[]> {
      const rows = await repository.listByProject(projectId, filter);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toRfi(r, counts.get(r.id) ?? 0));
    },

    async get(projectId: string, rfiId: string, sharedOnly = false): Promise<RfiDetail> {
      const row = await loadRow(projectId, rfiId);
      if (sharedOnly && row.visibility !== "shared") throw new NotFoundError("RFI");
      const comments = await repository.listComments(rfiId);
      const events = await repository.listEvents(rfiId);
      const visibleComments = sharedOnly
        ? comments.filter((c) => !c.is_proposed_response)
        : comments;
      return {
        ...toRfi(row, comments.length),
        comments: visibleComments.map(toComment),
        events: events.map(toEvent),
      };
    },

    async create(
      projectId: string,
      input: CreateRfiInput,
      actor: Actor,
      visibility: RfiVisibility,
    ): Promise<Rfi> {
      const hasAssignee = Boolean(input.ballInCourtId) || Boolean(input.ballInCourtEmail);
      const row = await repository.create({
        id: generateId("rfi"),
        project_id: projectId,
        subject: input.subject,
        question: input.question,
        status: hasAssignee ? "Open" : "Draft",
        priority: input.priority ?? "Normal",
        visibility,
        ball_in_court_id: input.ballInCourtId ?? null,
        ball_in_court_name: input.ballInCourtName ?? null,
        ball_in_court_email: input.ballInCourtEmail ?? null,
        assignee_role: input.assigneeRole ?? null,
        due_date: input.dueDate ?? null,
        cost_impact: input.costImpact ?? false,
        schedule_impact: input.scheduleImpact ?? false,
        created_by_id: actor.id,
        document_id: input.documentId ?? null,
        document_version_id: input.documentVersionId ?? null,
        source_markup_id: input.sourceMarkupId ?? null,
      });
      await logEvent(row.id, "created", actor, { number: row.number });
      if (hasAssignee) {
        await logEvent(row.id, "opened", actor, {
          ballInCourtId: input.ballInCourtId ?? null,
          ballInCourtEmail: input.ballInCourtEmail ?? null,
        });
        notifyRfiAssignee(input.ballInCourtId, projectId, row.subject, actor.id);
      }
      return toRfi(row, 0);
    },

    async update(
      projectId: string,
      rfiId: string,
      input: UpdateRfiInput,
      actor: Actor,
    ): Promise<Rfi> {
      const current = await loadRow(projectId, rfiId);
      const patch: RfiUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.subject !== undefined) patch.subject = input.subject;
      if (input.question !== undefined) patch.question = input.question;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.assigneeRole !== undefined) patch.assignee_role = input.assigneeRole;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.costImpact !== undefined) patch.cost_impact = input.costImpact;
      if (input.scheduleImpact !== undefined) patch.schedule_impact = input.scheduleImpact;

      const nextBallInCourtId = input.ballInCourtId !== undefined
        ? input.ballInCourtId
        : current.ball_in_court_id;
      const nextBallInCourtEmail = input.ballInCourtEmail !== undefined
        ? input.ballInCourtEmail
        : input.ballInCourtId !== undefined
          ? null
        : current.ball_in_court_email;
      const ballInCourtChanged =
        (input.ballInCourtId !== undefined && input.ballInCourtId !== current.ball_in_court_id) ||
        (input.ballInCourtEmail !== undefined && input.ballInCourtEmail !== current.ball_in_court_email);

      if (input.ballInCourtId !== undefined) {
        patch.ball_in_court_id = input.ballInCourtId;
        if (input.ballInCourtName === undefined) patch.ball_in_court_name = null;
        if (input.ballInCourtEmail === undefined) patch.ball_in_court_email = null;
      }
      if (input.ballInCourtName !== undefined) patch.ball_in_court_name = input.ballInCourtName;
      if (input.ballInCourtEmail !== undefined) patch.ball_in_court_email = input.ballInCourtEmail;
      if (current.status === "Draft" && (nextBallInCourtId || nextBallInCourtEmail)) {
        patch.status = "Open";
      }

      const row = await repository.update(rfiId, patch);
      if (!row) throw new NotFoundError("RFI");
      if (ballInCourtChanged) {
        await logEvent(rfiId, "ball_in_court_changed", actor, {
          ballInCourtId: nextBallInCourtId,
          ballInCourtEmail: nextBallInCourtEmail,
        });
        notifyRfiAssignee(nextBallInCourtId, projectId, row.subject, actor.id);
      }
      const counts = await repository.commentCounts([rfiId]);
      return toRfi(row, counts.get(rfiId) ?? 0);
    },

    async respond(
      projectId: string,
      rfiId: string,
      input: RespondInput,
      actor: Actor,
      canRespondOfficially: boolean,
    ): Promise<RfiDetail> {
      const current = await loadRow(projectId, rfiId);
      if (current.status === "Closed" || current.status === "Void") {
        throw new ForbiddenError("This RFI is closed");
      }
      const official = input.official === true;
      if (official && !canRespondOfficially) {
        throw new ForbiddenError("Only an RFI manager can post the official response");
      }

      await repository.addComment({
        id: generateId("rfic"),
        rfi_id: rfiId,
        author_id: actor.id,
        author_name: actor.name,
        body: input.body,
        is_proposed_response: !official,
        created_at: new Date().toISOString(),
        content_html: input.contentHtml ?? null,
        attachments: input.attachments,
        references: input.references,
      });

      if (official) {
        const now = new Date().toISOString();
        await repository.update(rfiId, {
          status: "Answered",
          official_response: input.body,
          official_responded_by_id: actor.id,
          official_responded_at: now,
          ball_in_court_id: current.created_by_id,
          ball_in_court_name: null,
          ball_in_court_email: null,
          updated_at: now,
        });
        await logEvent(rfiId, "answered", actor);
        if (deps.notifications && current.created_by_id && current.created_by_id !== actor.id) {
          void deps.notifications
            .notify(current.created_by_id, "rfi_answered", {
              title: "Your RFI was answered",
              body: current.subject,
              projectId,
            })
            .catch(() => undefined);
        }
      } else {
        await logEvent(rfiId, "response_proposed", actor);
      }

      return this.get(projectId, rfiId);
    },

    async transition(
      projectId: string,
      rfiId: string,
      target: "Closed" | "Void" | "Open",
      actor: Actor,
    ): Promise<Rfi> {
      const current = await loadRow(projectId, rfiId);
      const patch: RfiUpdatePatch = { updated_at: new Date().toISOString() };

      if (target === "Open") {
        if (!REOPENABLE.has(current.status)) {
          throw new ForbiddenError("Only an answered or closed RFI can be reopened");
        }
        patch.status = "Open";
        patch.reopened_count = current.reopened_count + 1;
      } else {
        patch.status = target;
      }

      const row = await repository.update(rfiId, patch);
      if (!row) throw new NotFoundError("RFI");
      await logEvent(
        rfiId,
        target === "Open" ? "reopened" : target === "Void" ? "voided" : "closed",
        actor,
      );
      const counts = await repository.commentCounts([rfiId]);
      return toRfi(row, counts.get(rfiId) ?? 0);
    },

    async addComment(
      projectId: string,
      rfiId: string,
      body: string,
      actor: Actor,
    ): Promise<RfiComment> {
      await loadRow(projectId, rfiId);
      const row = await repository.addComment({
        id: generateId("rfic"),
        rfi_id: rfiId,
        author_id: actor.id,
        author_name: actor.name,
        body,
        is_proposed_response: false,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },

    async listDistribution(projectId: string, rfiId: string): Promise<RfiDistributionMember[]> {
      await loadRow(projectId, rfiId);
      const rows = await repository.listDistribution(rfiId);
      return rows.map(toDistribution);
    },

    async addDistribution(
      projectId: string,
      rfiId: string,
      input: DistributionInput,
      actor: Actor,
      tokenTtlDays: number,
    ): Promise<{ member: RfiDistributionMember; replyToken: string | null }> {
      await loadRow(projectId, rfiId);
      const external = !input.userId && Boolean(input.email);
      const role: RfiDistributionRole = input.role ?? (external ? "responder" : "viewer");

      let replyToken: string | null = null;
      let tokenHash: string | null = null;
      let expiresAt: string | null = null;
      if (external && role === "responder") {
        replyToken = randomBytes(32).toString("base64url");
        tokenHash = hashReplyToken(replyToken);
        expiresAt = new Date(Date.now() + tokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const row = await repository.addDistribution({
        id: generateId("rfid"),
        rfi_id: rfiId,
        user_id: input.userId ?? null,
        email: input.email ?? null,
        name: input.name ?? null,
        role,
        reply_token_hash: tokenHash,
        token_expires_at: expiresAt,
      });
      await logEvent(rfiId, "distribution_added", actor, {
        email: input.email ?? null,
        userId: input.userId ?? null,
        role,
      });
      return { member: toDistribution(row), replyToken };
    },

    async replyByToken(rawToken: string, body: string): Promise<ExternalReplyResult> {
      const member = await repository.distributionByTokenHash(hashReplyToken(rawToken));
      if (!member) return { ok: false, rfiSubject: "", rfiNumber: 0, reason: "not_found" };

      const rfi = await repository.findById(member.rfi_id);
      if (!rfi) return { ok: false, rfiSubject: "", rfiNumber: 0, reason: "not_found" };

      if (member.token_consumed_at) {
        return { ok: false, rfiSubject: rfi.subject, rfiNumber: rfi.number, reason: "consumed" };
      }
      if (member.token_expires_at && new Date(member.token_expires_at) < new Date()) {
        return { ok: false, rfiSubject: rfi.subject, rfiNumber: rfi.number, reason: "expired" };
      }

      await repository.addComment({
        id: generateId("rfic"),
        rfi_id: rfi.id,
        author_id: member.user_id ?? `external:${member.id}`,
        author_name: member.name ?? member.email ?? "External responder",
        body,
        is_proposed_response: true,
        created_at: new Date().toISOString(),
      });
      await repository.consumeDistributionToken(member.id);
      await logEvent(rfi.id, "external_response_proposed", null, {
        email: member.email,
      });
      return { ok: true, rfiSubject: rfi.subject, rfiNumber: rfi.number };
    },

    async convertToChange(projectId: string, rfiId: string, actor: Actor): Promise<Rfi> {
      const current = await loadRow(projectId, rfiId);
      if (!deps.changeRequests) {
        throw new ForbiddenError("Change request conversion is unavailable");
      }
      if (current.change_request_id) {
        const counts = await repository.commentCounts([rfiId]);
        return toRfi(current, counts.get(rfiId) ?? 0);
      }
      const change = await deps.changeRequests.create(
        projectId,
        {
          title: `RFI-${current.number}: ${current.subject}`,
          description: current.official_response ?? current.question,
        },
        actor.id,
      );
      const row = await repository.update(rfiId, {
        change_request_id: change.id,
        updated_at: new Date().toISOString(),
      });
      if (!row) throw new NotFoundError("RFI");
      await logEvent(rfiId, "converted_to_change", actor, { changeRequestId: change.id });
      const counts = await repository.commentCounts([rfiId]);
      return toRfi(row, counts.get(rfiId) ?? 0);
    },

    async dueForReminder(today: string): Promise<Rfi[]> {
      const rows = await repository.listDueForReminder(today);
      return rows.map((r) => toRfi(r, 0));
    },

    async markReminded(rfiId: string, today: string): Promise<void> {
      await repository.markReminded(rfiId, today);
    },
  };
}

export type RfisService = ReturnType<typeof rfisService>;
