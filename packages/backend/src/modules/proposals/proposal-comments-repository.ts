import type { Knex } from "knex";
import type { ProposalEvent, ProposalEventRow } from "./types.ts";

interface CommentRow {
  id: string;
  proposal_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface Comment {
  id: string;
  proposalId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function toEvent(row: ProposalEventRow): ProposalEvent {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    type: row.type,
    actor: row.actor,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export type ProposalCommentsRepository = ReturnType<typeof proposalCommentsRepository>;

// The proposal's activity trail: what happened to it, and what people said
// about it on the way.
export function proposalCommentsRepository(db: Knex) {
  // --- Events ---

  async function logEvent(
    proposalId: string,
    type: string,
    actor: string | null,
    metadata?: unknown,
  ): Promise<void> {
    await db("proposal_events").insert({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      proposal_id: proposalId,
      type,
      actor,
      metadata: metadata ?? null,
    });
  }

  async function listEvents(proposalId: string): Promise<ProposalEvent[]> {
    const rows = await db<ProposalEventRow>("proposal_events")
      .where({ proposal_id: proposalId })
      .orderBy("created_at", "desc")
      .limit(50);
    return rows.map(toEvent);
  }

  // --- Comments ---

  async function listComments(proposalId: string): Promise<Comment[]> {
    const rows = await db<CommentRow>("proposal_comments")
      .where({ proposal_id: proposalId })
      .orderBy("created_at", "asc")
      .limit(200);
    return rows.map(toComment);
  }

  async function insertComment(data: {
    id: string;
    proposalId: string;
    authorId: string | null;
    authorName: string;
    body: string;
  }): Promise<Comment> {
    const rows = await db<CommentRow>("proposal_comments")
      .insert({
        id: data.id,
        proposal_id: data.proposalId,
        author_id: data.authorId ?? null,
        author_name: data.authorName,
        body: data.body,
      })
      .returning("*");
    return toComment(rows[0]!);
  }

  return { logEvent, listEvents, listComments, insertComment };
}
