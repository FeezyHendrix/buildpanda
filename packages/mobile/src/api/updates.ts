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

/** One already-uploaded file. `url` points at the server's `/files/:id/view`. */
export interface CreateUpdateMediaInput {
  type: "photo" | "video";
  url: string;
}

/**
 * The create body, exactly. The route declares `additionalProperties: false`,
 * so anything extra — an author, a local id, a staged path — is a 400.
 */
export interface CreateUpdateInput {
  category: UpdateCategory;
  title: string;
  description: string;
  descriptionHtml?: string | null;
  /** At most 10; the bytes must already be uploaded. */
  media?: CreateUpdateMediaInput[];
}

export const updatesApi = {
  list: (projectId: string) => request<ProjectUpdate[]>(`/projects/${projectId}/updates`),

  create: (projectId: string, body: CreateUpdateInput) =>
    request<ProjectUpdate>(`/projects/${projectId}/updates`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
