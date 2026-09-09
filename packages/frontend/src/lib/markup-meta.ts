import { ClipboardCheck, ListTodo, MessageSquare } from "lucide-react";

export type CommentMode = "text" | "audio" | "video";
export type FollowUpKind = "none" | "rfi" | "approval" | "task";

export const COMMENT_MODE = {
  TEXT: "text",
  AUDIO: "audio",
  VIDEO: "video",
} as const satisfies Record<string, CommentMode>;

export const FOLLOW_UP = {
  NONE: "none",
  RFI: "rfi",
  APPROVAL: "approval",
  TASK: "task",
} as const satisfies Record<string, FollowUpKind>;

export interface CommentCapture {
  text: string;
  bodyHtml: string | null;
  mode: CommentMode;
  mediaBlob: Blob | null;
  mediaDurationSeconds: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  followUp: FollowUpKind;
}

export interface CommentAssignee {
  id: string;
  name: string;
}

export const FOLLOW_UPS: { id: FollowUpKind; label: string }[] = [
  { id: FOLLOW_UP.NONE, label: "Comment only" },
  { id: FOLLOW_UP.RFI, label: "Raise an RFI" },
  { id: FOLLOW_UP.APPROVAL, label: "Request approval" },
  { id: FOLLOW_UP.TASK, label: "Create a task" },
];

export const FOLLOW_UP_META: Record<
  Exclude<FollowUpKind, "none">,
  { label: string; Icon: typeof MessageSquare }
> = {
  rfi: { label: "RFI", Icon: MessageSquare },
  approval: { label: "Approval", Icon: ClipboardCheck },
  task: { label: "Task", Icon: ListTodo },
};
