import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
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
}

export interface UpdateQueryInput {
  subject?: string;
  question?: string;
  status?: QueryStatus;
  answer?: string | null;
  dueDate?: string | null;
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

export function queriesService(repository: QueriesRepository) {
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
      });
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

      // Capture who answered, and when, the first time an answer is recorded
      // (either explicitly via answer text or by moving to the Answered status).
      const becomingAnswered =
        (input.status === "Answered" && existing.status !== "Answered") ||
        (input.answer !== undefined && input.answer !== null && input.answer.trim() !== "" && !existing.answered_at);
      if (input.status !== undefined) patch.status = input.status;
      if (becomingAnswered) {
        patch.answered_at = new Date().toISOString();
        patch.answered_by_id = userId;
        if (input.status === undefined && existing.status === "Open") patch.status = "Answered";
      }

      const updated = await repository.update(queryId, patch);
      if (!updated) throw new NotFoundError("Query");
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
