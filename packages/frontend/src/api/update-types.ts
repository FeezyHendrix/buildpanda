import type { Person, MediaItem, UpdateCategory, UpdateStatus, UpdateAction } from "@/lib/project-types";

export interface ProjectUpdate {
  id: string;
  projectId: string;
  activityId: string | null;
  stageId?: string | null;
  author: Person;
  category: UpdateCategory;
  title: string;
  description: string;
  media: MediaItem[];
  cta: { label: string; tone: "primary" | "secondary" };
  secondaryAction?: { label: string };
  status: UpdateStatus;
  action: UpdateAction;
  isDraft: boolean;
  generatedKind: string | null;
  createdAt: string;
}
