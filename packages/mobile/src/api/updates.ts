import { request } from "./client";

export type UpdateCategory = "Progress" | "Material Delivery" | "Inspections" | "Issues";

export interface ProjectUpdate {
  id: string;
  category: UpdateCategory;
  title: string;
  description: string;
  descriptionHtml: string | null;
  author: { id: string; name: string; role: string };
  media: { id: string; type: "photo" | "video"; url: string }[];
  status: string;
  isDraft: boolean;
  generatedKind: string | null;
  createdAt: string;
}

export const updatesApi = {
  list: (projectId: string) => request<ProjectUpdate[]>(`/projects/${projectId}/updates`),
};
