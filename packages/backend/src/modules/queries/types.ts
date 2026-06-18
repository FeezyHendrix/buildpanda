export type QueryStatus = "Open" | "Answered" | "Closed";

export interface Query {
  id: string;
  projectId: string;
  subject: string;
  question: string;
  status: QueryStatus;
  answer: string | null;
  dueDate: string | null;
  askedById: string | null;
  answeredById: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueryComment {
  id: string;
  queryId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface QueryDetail extends Query {
  comments: QueryComment[];
}

export interface QueryRow {
  id: string;
  project_id: string;
  subject: string;
  question: string;
  status: QueryStatus;
  answer: string | null;
  due_date: string | null;
  asked_by_id: string | null;
  answered_by_id: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryCommentRow {
  id: string;
  query_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
