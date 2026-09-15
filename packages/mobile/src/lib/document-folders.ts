import type { DocumentCategory, DocumentGroup } from "@/api/documents";
import type { LocalDocument } from "@/db/documents-repository";

export const UNFILED_CATEGORY = "__unfiled__";

/** A cached file remains reachable even if its folder request failed. */
export function documentFolders(
  categories: readonly DocumentCategory[],
  documents: readonly LocalDocument[],
  group: DocumentGroup,
): DocumentCategory[] {
  const folders = new Map(categories.filter((row) => row.group === group).map((row) => [row.id, { ...row }]));
  const counts = new Map<string, number>();
  for (const document of documents) {
    if (document.group !== group) continue;
    const id = document.categoryId ?? UNFILED_CATEGORY;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!folders.has(id)) {
      folders.set(id, { id, name: document.category ?? "Other files", group, fileCount: 0, totalSize: "", tone: "brand" });
    }
  }
  for (const [id, count] of counts) folders.get(id)!.fileCount = count;
  return [...folders.values()].sort((a, b) => a.name.localeCompare(b.name));
}
