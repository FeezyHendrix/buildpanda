import { SearchInput } from "@/components/atoms/search-input";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import type { DocumentCategory, ProjectDocument } from "@/lib/project-types";

export interface DocumentFilters {
  query: string;
  categoryName: string | null;
}

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = { query: "", categoryName: null };

/** Pure so the page derives the visible rows during render, never in an effect. */
export function applyDocumentFilters(documents: ProjectDocument[], filters: DocumentFilters): ProjectDocument[] {
  const needle = filters.query.trim().toLowerCase();
  return documents.filter((doc) => {
    if (filters.categoryName && doc.category !== filters.categoryName) return false;
    if (needle && !doc.fileName.toLowerCase().includes(needle) && !doc.category.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });
}

export function DocumentFilterBar({
  filters,
  onChange,
  categories,
  searchPlaceholder,
}: {
  filters: DocumentFilters;
  onChange: (next: DocumentFilters) => void;
  categories: DocumentCategory[];
  searchPlaceholder: string;
}) {
  const categoryNames = categories.map((c) => c.name);
  return (
    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 rounded-lg border border-line-hair bg-white lg:max-w-md">
        <SearchInput
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </div>
      <SearchableSelect
        items={categoryNames}
        value={filters.categoryName}
        onChange={(categoryName) => onChange({ ...filters, categoryName })}
        placeholder="All categories"
        searchPlaceholder="Find a category"
        emptyText="No category matches."
        variant="filter"
        className="lg:w-56"
      />
    </div>
  );
}
DocumentFilterBar.displayName = "DocumentFilterBar";
