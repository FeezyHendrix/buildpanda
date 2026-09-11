import { SearchInput } from "@/components/atoms/search-input";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import type { DocumentCategory, DocumentStatus, ProjectDocument } from "@/lib/project-types";
import { cn } from "@/lib/utils";

export const DOCUMENT_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "Verified", label: "Verified" },
  { value: "Pending", label: "Pending" },
  { value: "Expired", label: "Expired" },
] as const satisfies readonly { value: DocumentStatus | "all"; label: string }[];

export type DocumentStatusFilter = (typeof DOCUMENT_STATUS_FILTERS)[number]["value"];

export interface DocumentFilters {
  query: string;
  categoryName: string | null;
  status: DocumentStatusFilter;
}

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = { query: "", categoryName: null, status: "all" };

/** Pure so the page derives the visible rows during render, never in an effect. */
export function applyDocumentFilters(documents: ProjectDocument[], filters: DocumentFilters): ProjectDocument[] {
  const needle = filters.query.trim().toLowerCase();
  return documents.filter((doc) => {
    if (filters.status !== "all" && doc.status !== filters.status) return false;
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
      <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white">
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
        className="lg:w-56"
      />
      <div className="inline-flex self-start rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
        {DOCUMENT_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange({ ...filters, status: f.value })}
            aria-pressed={filters.status === f.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filters.status === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
DocumentFilterBar.displayName = "DocumentFilterBar";
