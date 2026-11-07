export const ATTENTION_KINDS = ["rfi", "approval", "change_request", "task", "inspection", "permit", "key_date"] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/**
 * blocking — work cannot proceed until it is decided or fixed (overdue RFI,
 *            failed inspection, expired permit, missed key date, overdue task).
 * due_soon — a date inside the look-ahead window.
 * review   — waiting on someone's decision.
 */
export type AttentionTag = "blocking" | "due_soon" | "review";

export interface AttentionAssignee {
  id: string | null;
  name: string;
  profession: string | null;
}

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  tag: AttentionTag;
  title: string;
  assignee: AttentionAssignee | null;
  dueDate: string | null;
  href: string;
}

export interface AttentionFeed {
  items: AttentionItem[];
  total: number;
}

/** One candidate row from any of the source tables, before tagging. */
export interface AttentionRow {
  id: string;
  kind: AttentionKind;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_profession: string | null;
}
