

export type RfiStatus = "Draft" | "Open" | "InReview" | "Answered" | "Closed" | "Void";
export type RfiPriority = "Low" | "Normal" | "High";

export interface Rfi {
  id: string;
  projectId: string;
  number: number;
  subject: string;
  question: string;
  questionHtml: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  visibility: "internal" | "shared";
  ballInCourtId: string | null;
  ballInCourtName: string | null;
  ballInCourtEmail: string | null;
  assigneeRole: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  officialResponseHtml: string | null;
  officialRespondedById: string | null;
  officialRespondedByName: string | null;
  officialRespondedAt: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  changeRequestId: string | null;
  reopenedCount: number;
  createdById: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RfiComment {
  id: string;
  rfiId: string;
  authorId: string;
  authorName: string;
  body: string;
  contentHtml: string | null;
  attachments: { fileId: string; url: string; name: string }[];
  references: { type: "action_item" | "activity"; id: string; label: string }[];
  isProposedResponse: boolean;
  createdAt: string;
}

export interface RfiEvent {
  id: string;
  rfiId: string;
  type: string;
  actorId: string | null;
  actorLabel: string | null;
  detail: unknown;
  createdAt: string;
}

export interface RfiDetail extends Rfi {
  comments: RfiComment[];
  events: RfiEvent[];
}
