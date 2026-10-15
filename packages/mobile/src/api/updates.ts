import { request } from "./client";

export type UpdateCategory = "Progress" | "Material Delivery" | "Inspections" | "Issues";

export interface UpdateComment {
  id: string;
  updateId: string;
  author: { id: string; name: string };
  body: string;
  bodyHtml?: string | null;
  audioFileId?: string | null;
  audioDurationSeconds?: number | null;
  createdAt: string;
}
export interface UpdateCommentInput {
  body: string;
  bodyHtml?: string | null;
  audioFileId?: string | null;
  audioDurationSeconds?: number | null;
  clientMutationId?: string;
}

export interface ProjectUpdate {
  stageId?: string | null;
  activityId?: string | null;
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
 * so anything extra — an author, a local id, a staged path — is a 400. Note
 * that `activityId` is not among them: the stage link is the only one the
 * create route accepts.
 */
export interface CreateUpdateInput {
  category: UpdateCategory;
  title: string;
  description: string;
  descriptionHtml?: string | null;
  stageId?: string | null;
  /** At most 10; the bytes must already be uploaded. */
  media?: CreateUpdateMediaInput[];
}

export const updatesApi = {
  edit: (projectId: string, updateId: string, body: { title?: string; description?: string }) =>
    request<ProjectUpdate>(`/projects/${projectId}/updates/${updateId}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (projectId: string, updateId: string) => request<void>(`/projects/${projectId}/updates/${updateId}`, { method: "DELETE" }),
  comments: (projectId: string, updateId: string) => request<UpdateComment[]>(`/projects/${projectId}/updates/${updateId}/comments`),
  comment: (projectId: string, updateId: string, body: string | UpdateCommentInput) =>
    request<UpdateComment>(`/projects/${projectId}/updates/${updateId}/comments`, { method: "POST", body: JSON.stringify(typeof body === "string" ? { body } : body) }),
  list: (projectId: string) => request<ProjectUpdate[]>(`/projects/${projectId}/updates`),

  create: (projectId: string, body: CreateUpdateInput) =>
    request<ProjectUpdate>(`/projects/${projectId}/updates`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
