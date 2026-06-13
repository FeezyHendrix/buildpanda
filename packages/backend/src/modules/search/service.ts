import type { SearchRepository } from "./repository.ts";
import type {
  SearchDocumentHit,
  SearchInspectionHit,
  SearchProjectHit,
  SearchResults,
  SearchUpdateHit,
} from "./types.ts";

const DEFAULT_LIMIT = 5;
const MAX_QUERY_LENGTH = 100;
const SNIPPET_LENGTH = 140;

function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function snippet(text: string, query: string): string {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_LENGTH);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  const prefix = start === 0 ? "" : "…";
  const suffix = end === text.length ? "" : "…";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export interface SearchInput {
  query: string;
  limit?: number;
  orgIds?: string[];
  participantProjectIds?: string[];
}

export function searchService(repository: SearchRepository) {
  return {
    async search(userId: string, input: SearchInput): Promise<SearchResults> {
      const trimmed = input.query.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_QUERY_LENGTH) {
        return {
          query: trimmed,
          projects: [],
          updates: [],
          documents: [],
          inspections: [],
        };
      }

      const limit = input.limit ?? DEFAULT_LIMIT;
      const pattern = `%${escapeLikePattern(trimmed)}%`;
      const scope = {
        userId,
        orgIds: input.orgIds ?? [],
        participantProjectIds: input.participantProjectIds ?? [],
        pattern,
        limit,
      };

      const [projectsRows, updatesRows, documentsRows, inspectionsRows] = await Promise.all([
        repository.projects(scope),
        repository.updates(scope),
        repository.documents(scope),
        repository.inspections(scope),
      ]);

      const projects: SearchProjectHit[] = projectsRows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        snippet: snippet(`${row.name} · ${row.address}`, trimmed),
      }));

      const updates: SearchUpdateHit[] = updatesRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        snippet: snippet(row.description, trimmed),
        category: row.category,
      }));

      const documents: SearchDocumentHit[] = documentsRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        fileName: row.file_name,
        category: row.category_name ?? "",
      }));

      const inspections: SearchInspectionHit[] = inspectionsRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        snippet: snippet(row.description, trimmed),
        category: row.category,
      }));

      return { query: trimmed, projects, updates, documents, inspections };
    },
  };
}

export type SearchService = ReturnType<typeof searchService>;
