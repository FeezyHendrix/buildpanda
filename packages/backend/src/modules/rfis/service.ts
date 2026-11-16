import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { RfisRepository, RfiUpdatePatch } from "./repository.ts";
import type { Rfi, RfiComment, RfiDetail, RfiEvent, RfiListFilters, RfiRow, RfiStatus, RfiVisibility,
  CreateRfiInput, UpdateRfiInput, RespondInput, Actor, ChangeRequestCreator } from "./types.ts";
import { toRfi, toComment, toEvent } from "./mappers.ts";
import { rfiDistribution } from "./distribution.ts";
export { hashReplyToken } from "./distribution.ts";
export type { CreateRfiInput, UpdateRfiInput, RespondInput, Actor, DistributionInput, ExternalReplyResult, ChangeRequestCreator } from "./types.ts";

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
    rfiId: string,
  ): void {
    if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
    void deps.notifications
      .notify(assigneeId, "rfi_assigned", {
        title: "An RFI was assigned to you",
        body: subject,
        projectId,
        ctaUrl: `/project/${projectId}/rfis?rfi=${rfiId}`,
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
    ...rfiDistribution(repository, loadRow, logEvent),
    async list(
      projectId: string,
      filter: RfiListFilters,
    ): Promise<Rfi[]> {
      const rows = await repository.listByProject(projectId, filter);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toRfi(r, counts.get(r.id) ?? 0));
    },

    async listEvents(projectId: string, rfiId: string): Promise<RfiEvent[]> {
      await loadRow(projectId, rfiId);
      const events = await repository.listEvents(rfiId);
      return events.map(toEvent);
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
          question_html: input.questionHtml ?? null,
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
        notifyRfiAssignee(input.ballInCourtId, projectId, row.subject, actor.id, row.id);
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
        if (input.questionHtml !== undefined) patch.question_html = input.questionHtml;
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
        notifyRfiAssignee(nextBallInCourtId, projectId, row.subject, actor.id, row.id);
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
          official_response_html: input.contentHtml ?? null,
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
              ctaUrl: `/project/${projectId}/rfis?rfi=${rfiId}`,
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
      content: Pick<RespondInput, "contentHtml" | "attachments" | "references"> = {},
    ): Promise<RfiComment> {
      await loadRow(projectId, rfiId);
      const row = await repository.addComment({
        id: generateId("rfic"),
        rfi_id: rfiId,
        author_id: actor.id,
        author_name: actor.name,
        body,
        content_html: content.contentHtml ?? null,
        attachments: content.attachments,
        references: content.references,
        is_proposed_response: false,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },

    async convertToChange(
      projectId: string,
      rfiId: string,
      actor: Actor,
      changeRequestId?: string | null,
    ): Promise<Rfi> {
      const current = await loadRow(projectId, rfiId);
      if (!deps.changeRequests) {
        throw new ForbiddenError("Change request conversion is unavailable");
      }
      if (current.change_request_id) {
        const counts = await repository.commentCounts([rfiId]);
        return toRfi(current, counts.get(rfiId) ?? 0);
      }
      // One site event is one change event. When the commercial team has already
      // raised the variation, link it instead of minting a duplicate £0 draft.
      const change = changeRequestId
        ? await deps.changeRequests.get(projectId, changeRequestId)
        : await deps.changeRequests.create(
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
      await logEvent(rfiId, "converted_to_change", actor, {
        changeRequestId: change.id,
        linked: Boolean(changeRequestId),
      });
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
