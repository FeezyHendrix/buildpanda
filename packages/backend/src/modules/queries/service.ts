import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { QueriesRepository, QueryUpdatePatch } from "./repository.ts";
import type {
  Query,
  QueryComment,
  QueryCommentRow,
  QueryDetail,
  QueryRow,
  QueryStatus,
} from "./types.ts";

export interface CreateQueryInput {
  subject: string;
  question: string;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface UpdateQueryInput {
  subject?: string;
  question?: string;
  status?: QueryStatus;
  answer?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
}

function toQuery(row: QueryRow, commentCount: number): Query {
  return {
    id: row.id,
    projectId: row.project_id,
    subject: row.subject,
    question: row.question,
    status: row.status,
    answer: row.answer,
    dueDate: row.due_date,
    askedById: row.asked_by_id,
    answeredById: row.answered_by_id,
    answeredByName: row.answered_by_name,
    answeredAt: row.answered_at,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComment(row: QueryCommentRow): QueryComment {
  return {
    id: row.id,
    queryId: row.query_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export interface QueriesDeps {
  notifications?: NotificationsService;
}

function notifyQueryAssignee(
  deps: QueriesDeps,
  assigneeId: string | null | undefined,
  projectId: string,
  subject: string,
  actorId: string,
): void {
  if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
  void deps.notifications
    .notify(assigneeId, "query_assigned", {
      title: "A query was assigned to you",
      body: subject,
      projectId,
    })
    .catch(() => undefined);
}

function notifyQueryAnswered(
  deps: QueriesDeps,
  askerId: string | null | undefined,
  projectId: string,
  subject: string,
  actorId: string,
): void {
  if (!deps.notifications || !askerId || askerId === actorId) return;
  void deps.notifications
    .notify(askerId, "query_answered", {
      title: "Your query was answered",
      body: subject,
      projectId,
    })
    .catch(() => undefined);
}

export function queriesService(repository: QueriesRepository, deps: QueriesDeps = {}) {
  return {
    async list(projectId: string, status?: QueryStatus): Promise<Query[]> {
      const rows = await repository.listByProject(projectId, status);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toQuery(r, counts.get(r.id) ?? 0));
    },

    async get(projectId: string, queryId: string): Promise<QueryDetail> {
      const row = await repository.findById(queryId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Query");
      const comments = await repository.listComments(queryId);
      return { ...toQuery(row, comments.length), comments: comments.map(toComment) };
    },

    async create(projectId: string, input: CreateQueryInput, userId: string): Promise<Query> {
      const row = await repository.create({
        id: generateId("qry"),
        project_id: projectId,
        subject: input.subject,
        question: input.question,
        status: "Open",
        due_date: input.dueDate ?? null,
        asked_by_id: userId,
        assignee_id: input.assigneeId ?? null,
      });
      notifyQueryAssignee(deps, row.assignee_id, projectId, row.subject, userId);
      return toQuery(row, 0);
    },

    async update(
      projectId: string,
      queryId: string,
      input: UpdateQueryInput,
      userId: string,
    ): Promise<Query> {
      const existing = await repository.findById(queryId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Query");

      const patch: QueryUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.subject !== undefined) patch.subject = input.subject;
      if (input.question !== undefined) patch.question = input.question;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.answer !== undefined) patch.answer = input.answer;

      const reassigned =
        input.assigneeId !== undefined && input.assigneeId !== existing.assignee_id;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;

      // Capture who answered, and when, the first time an answer is recorded
      // (either explicitly via answer text or by moving to the Answered status).
      const becomingAnswered =
        (input.status === "Answered" && existing.status !== "Answered") ||
        (input.answer !== undefined && input.answer !== null && input.answer.trim() !== "" && !existing.answered_at);
      const answeredOrClosed =
        input.status !== undefined &&
        ["Answered", "Closed"].includes(input.status) &&
        !["Answered", "Closed"].includes(existing.status);
      if (input.status !== undefined) patch.status = input.status;
      if (becomingAnswered) {
        patch.answered_at = new Date().toISOString();
        patch.answered_by_id = userId;
        if (input.status === undefined && existing.status === "Open") patch.status = "Answered";
      }
      if (answeredOrClosed || becomingAnswered) {
        notifyQueryAnswered(deps, existing.asked_by_id, projectId, existing.subject, userId);
      }

      const updated = await repository.update(queryId, patch);
      if (!updated) throw new NotFoundError("Query");
      if (reassigned) {
        notifyQueryAssignee(deps, updated.assignee_id, projectId, updated.subject, userId);
      }
      const counts = await repository.commentCounts([queryId]);
      return toQuery(updated, counts.get(queryId) ?? 0);
    },

    async remove(projectId: string, queryId: string): Promise<void> {
      const existing = await repository.findById(queryId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Query");
      await repository.remove(queryId);
    },

    async addComment(
      projectId: string,
      queryId: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<QueryComment> {
      const existing = await repository.findById(queryId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Query");
      const row = await repository.addComment({
        id: generateId("qrc"),
        query_id: queryId,
        author_id: author.id,
        author_name: author.name,
        body,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },
  };
}

export type QueriesService = ReturnType<typeof queriesService>;
