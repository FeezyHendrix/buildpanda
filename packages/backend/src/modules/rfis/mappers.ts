import type { Rfi, RfiRow, RfiComment, RfiCommentRow, RfiCommentAttachment, RfiCommentReference, RfiEvent, RfiEventRow, RfiDistributionMember, RfiDistributionRow } from "./types.ts";

export function toRfi(row: RfiRow, commentCount: number): Rfi {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    subject: row.subject,
      question: row.question,
      questionHtml: row.question_html,
      status: row.status,
    priority: row.priority,
    visibility: row.visibility,
    ballInCourtId: row.ball_in_court_id,
    ballInCourtName: row.ball_in_court_name,
    ballInCourtEmail: row.ball_in_court_email,
    assigneeRole: row.assignee_role,
    dueDate: row.due_date,
      officialResponse: row.official_response,
      officialResponseHtml: row.official_response_html,
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

export function toComment(row: RfiCommentRow): RfiComment {
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

export function toEvent(row: RfiEventRow): RfiEvent {
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

export function toDistribution(row: RfiDistributionRow): RfiDistributionMember {
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







