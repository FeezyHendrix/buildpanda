import api from "./client";
import type {
  DocumentCategory,
  DocumentVersion,
  DocumentVisibility,
  ProjectDocument,
} from "@/lib/project-types";

export interface CreateDocumentVariables extends DocumentRegisterInput {
  projectId: string;
  categoryId: string;
  fileId: string;
}

export interface EditDocumentVariables extends DocumentRegisterInput {
  projectId: string;
  documentId: string;
  categoryId?: string;
}

export interface DeleteDocumentVariables {
  projectId: string;
  documentId: string;
}

export interface FileShareResult {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
}

export interface AddVersionVariables {
  projectId: string;
  documentId: string;
  fileId: string;
  revisionLabel?: string;
  notes?: string;
}

/**
 * The identity of a document beyond its filename: a drawing register needs a
 * number and a revision, and a method statement is not the client's business
 * until it is issued (findings #3, F49).
 */
export interface DocumentRegisterInput {
  title?: string | null;
  revision?: string | null;
  supersedesId?: string | null;
  visibility?: DocumentVisibility;
  documentDate?: string | null;
}

export const documentsApi = {
  list: (projectId: string) =>
    api.get<ProjectDocument[]>(`/projects/${projectId}/documents`).then((r) => r.data),

  categories: (projectId: string) =>
    api.get<DocumentCategory[]>(`/projects/${projectId}/documents/categories`).then((r) => r.data),

  create: (projectId: string, body: DocumentRegisterInput & { categoryId: string; fileId: string }) =>
    api.post<ProjectDocument>(`/projects/${projectId}/documents`, body).then((r) => r.data),

  edit: (projectId: string, documentId: string, body: DocumentRegisterInput & { categoryId?: string }) =>
    api.put<ProjectDocument>(`/projects/${projectId}/documents/${documentId}`, body).then((r) => r.data),

  delete: (projectId: string, documentId: string) =>
    api.delete(`/projects/${projectId}/documents/${documentId}`).then((r) => r.data),

  share: (projectId: string, documentId: string) =>
    api.post<FileShareResult>(`/projects/${projectId}/documents/${documentId}/share`, {}).then((r) => r.data),

  versions: (projectId: string, documentId: string) =>
    api.get<DocumentVersion[]>(`/projects/${projectId}/documents/${documentId}/versions`).then((r) => r.data),

  addVersion: (projectId: string, documentId: string, body: { fileId: string; revisionLabel?: string; notes?: string }) =>
    api.post<DocumentVersion>(`/projects/${projectId}/documents/${documentId}/versions`, body).then((r) => r.data),
};
