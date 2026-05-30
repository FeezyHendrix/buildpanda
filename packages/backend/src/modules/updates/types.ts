import type { Tone } from "../projects/types.ts";

export type UpdateCategory = "Progress" | "Material Delivery" | "Inspections" | "Issues";
export type CtaTone = "primary" | "secondary";
export type MediaType = "photo" | "video";
export type UpdateStatus = "Open" | "Approved" | "Inspected" | "Resolved" | "Escalated";

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initialsTone?: Tone;
}

export interface UpdateAction {
  status: UpdateStatus;
  takenAt: string | null;
  takenBy: { id: string; name: string } | null;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  activityId: string | null;
  author: Person;
  category: UpdateCategory;
  title: string;
  description: string;
  media: MediaItem[];
  cta: { label: string; tone: CtaTone };
  secondaryAction?: { label: string };
  status: UpdateStatus;
  action: UpdateAction;
  createdAt: string;
}

export interface UpdateRow {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  author_initials_tone: Tone;
  author_avatar_url: string | null;
  category: UpdateCategory;
  title: string;
  description: string;
  cta_label: string;
  cta_tone: CtaTone;
  secondary_action_label: string | null;
  status: UpdateStatus;
  action_taken_at: Date | string | null;
  action_taken_by_id: string | null;
  action_taken_by_name: string | null;
  activity_id: string | null;
  created_at: Date | string;
}

export interface UpdateMediaRow {
  id: string;
  update_id: string;
  type: MediaType;
  url: string;
  sort_order: number;
}

export interface UpdateComment {
  id: string;
  updateId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export interface UpdateCommentRow {
  id: string;
  update_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: Date | string;
}
