import { useQuery } from "@tanstack/react-query";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENTS,
  FINANCES,
  INSPECTIONS,
  PROJECTS,
  RISK_FACTORS,
  UPDATES,
  type DocumentCategory,
  type InspectionReport,
  type Project,
  type ProjectDocument,
  type ProjectFinances,
  type ProjectUpdate,
  type RiskFactor,
} from "@/lib/project-mock-data";

export const projectKeys = {
  all: ["projects"] as const,
  list: ["projects", "list"] as const,
  detail: (id: string) => ["projects", id] as const,
  updates: (id: string) => ["projects", id, "updates"] as const,
  documents: (id: string) => ["projects", id, "documents"] as const,
  documentCategories: (id: string) =>
    ["projects", id, "documents", "categories"] as const,
  inspections: (id: string) => ["projects", id, "inspections"] as const,
  finances: (id: string) => ["projects", id, "finances"] as const,
  riskFactors: (id: string) => ["projects", id, "risk-factors"] as const,
};

function delayed<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: projectKeys.list,
    queryFn: () => delayed(PROJECTS),
  });
}

export function useProject(id: string | undefined) {
  return useQuery<Project | null>({
    queryKey: id ? projectKeys.detail(id) : ["projects", "detail-empty"],
    queryFn: () => delayed(PROJECTS.find((p) => p.id === id) ?? null),
    enabled: Boolean(id),
  });
}

export function useProjectUpdates(id: string | undefined) {
  return useQuery<ProjectUpdate[]>({
    queryKey: id ? projectKeys.updates(id) : ["projects", "updates-empty"],
    queryFn: () =>
      delayed(UPDATES.filter((u) => u.projectId === id)),
    enabled: Boolean(id),
  });
}

export function useProjectDocuments(id: string | undefined) {
  return useQuery<ProjectDocument[]>({
    queryKey: id ? projectKeys.documents(id) : ["projects", "docs-empty"],
    queryFn: () =>
      delayed(DOCUMENTS.filter((d) => d.projectId === id)),
    enabled: Boolean(id),
  });
}

export function useProjectDocumentCategories(id: string | undefined) {
  return useQuery<DocumentCategory[]>({
    queryKey: id
      ? projectKeys.documentCategories(id)
      : ["projects", "doc-cats-empty"],
    queryFn: () => delayed(DOCUMENT_CATEGORIES),
    enabled: Boolean(id),
  });
}

export function useProjectInspections(id: string | undefined) {
  return useQuery<InspectionReport[]>({
    queryKey: id ? projectKeys.inspections(id) : ["projects", "insp-empty"],
    queryFn: () =>
      delayed(INSPECTIONS.filter((i) => i.projectId === id)),
    enabled: Boolean(id),
  });
}

export function useProjectFinances(id: string | undefined) {
  return useQuery<ProjectFinances | null>({
    queryKey: id ? projectKeys.finances(id) : ["projects", "fin-empty"],
    queryFn: () => delayed((id && FINANCES[id]) || null),
    enabled: Boolean(id),
  });
}

export function useProjectRiskFactors(id: string | undefined) {
  return useQuery<RiskFactor[]>({
    queryKey: id ? projectKeys.riskFactors(id) : ["projects", "risk-empty"],
    queryFn: () => delayed(RISK_FACTORS),
    enabled: Boolean(id),
  });
}
