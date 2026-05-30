import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchInput } from "@/components/atoms/search-input";
import { useSearch } from "@/hooks/use-search";
import { cn } from "@/lib/utils";
import type {
  SearchDocumentHit,
  SearchInspectionHit,
  SearchProjectHit,
  SearchUpdateHit,
} from "@/lib/project-mock-data";

const DEBOUNCE_MS = 250;

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
}

interface ResultRow {
  key: string;
  title: string;
  subtitle: string;
  to: string;
}

function ResultGroup({
  label,
  rows,
  onSelect,
}: {
  label: string;
  rows: ResultRow[];
  onSelect: (to: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="py-1">
      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onSelect(row.to)}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left",
            "outline-none transition-colors hover:bg-[#F6F6F6] focus-visible:bg-[#F6F6F6]",
          )}
        >
          <span className="line-clamp-1 text-sm font-medium text-gray-900">
            {row.title}
          </span>
          <span className="line-clamp-1 text-xs text-gray-500">
            {row.subtitle}
          </span>
        </button>
      ))}
    </div>
  );
}

function projectRows(hits: SearchProjectHit[]): ResultRow[] {
  return hits.map((hit) => ({
    key: `project:${hit.id}`,
    title: hit.name,
    subtitle: hit.snippet || hit.address,
    to: `/project/${hit.id}/overview`,
  }));
}

function updateRows(hits: SearchUpdateHit[]): ResultRow[] {
  return hits.map((hit) => ({
    key: `update:${hit.id}`,
    title: hit.title,
    subtitle: hit.snippet || hit.category,
    to: `/project/${hit.projectId}/updates`,
  }));
}

function documentRows(hits: SearchDocumentHit[]): ResultRow[] {
  return hits.map((hit) => ({
    key: `document:${hit.id}`,
    title: hit.fileName,
    subtitle: hit.category,
    to: `/project/${hit.projectId}/documents`,
  }));
}

function inspectionRows(hits: SearchInspectionHit[]): ResultRow[] {
  return hits.map((hit) => ({
    key: `inspection:${hit.id}`,
    title: hit.title,
    subtitle: hit.snippet || hit.category,
    to: `/project/${hit.projectId}/inspections`,
  }));
}

function GlobalSearch({ placeholder, className }: GlobalSearchProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  const { data, isFetching } = useSearch(debounced);

  function handleSelect(to: string) {
    setOpen(false);
    setQuery("");
    setDebounced("");
    navigate(to);
  }

  const hasQuery = debounced.length > 0;
  const totalHits = data
    ? data.projects.length +
      data.updates.length +
      data.documents.length +
      data.inspections.length
    : 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <SearchInput
        value={query}
        placeholder={placeholder}
        className="w-full bg-[#F6F6F6]"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />

      {open && hasQuery && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[28rem] max-w-[80vw] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          {totalHits === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">
              {isFetching ? "Searching…" : `No results for "${debounced}".`}
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto pb-1">
              <ResultGroup
                label="Projects"
                rows={projectRows(data!.projects)}
                onSelect={handleSelect}
              />
              <ResultGroup
                label="Updates"
                rows={updateRows(data!.updates)}
                onSelect={handleSelect}
              />
              <ResultGroup
                label="Documents"
                rows={documentRows(data!.documents)}
                onSelect={handleSelect}
              />
              <ResultGroup
                label="Inspections"
                rows={inspectionRows(data!.inspections)}
                onSelect={handleSelect}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

GlobalSearch.displayName = "GlobalSearch";

export { GlobalSearch, type GlobalSearchProps };
