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
  descriptionHtml: string | null;
  media: MediaItem[];
  cta: { label: string; tone: CtaTone };
  secondaryAction?: { label: string };
  status: UpdateStatus;
  action: UpdateAction;
  isDraft: boolean;
  generatedKind: string | null;
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
  description_html: string | null;
  cta_label: string;
  cta_tone: CtaTone;
  secondary_action_label: string | null;
  status: UpdateStatus;
  action_taken_at: Date | string | null;
  action_taken_by_id: string | null;
  action_taken_by_name: string | null;
  activity_id: string | null;
  is_draft: boolean;
  generated_kind: string | null;
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

export interface DigestRow {
  label: string | null;
  status: string | null;
}

export interface DigestProjectRow {
  id: string;
  name: string;
  owner_id: string | null;
  organization_id: string | null;
}

export interface DigestOrgAdminRow {
  organizationId: string;
  userId: string;
}

export interface DigestSection {
  heading: string;
  items: string[];
}

export interface DigestSiteLog {
  weather: string | null;
  temperatureC: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
}

export interface DigestSiteNote {
  author: string;
  body: string;
}

export interface DigestLoggedActivity {
  name: string;
  hours: number;
}

export interface DailyDigestContext {
  projectName: string;
  digestDate: string;
  dateLabel: string;
  progressPercent: number;
  currentStage: string | null;
  siteLog: DigestSiteLog | null;
  siteNotes: DigestSiteNote[];
  loggedActivities: DigestLoggedActivity[];
  sections: DigestSection[];
}

export type DailyDigestDraft =
  | { status: "created"; update: ProjectUpdate }
  | { status: "existing"; update: ProjectUpdate };

export type DailyDigestOutcome = DailyDigestDraft | { status: "quiet" };
