import { useState } from "react";
import type { InspectionCategoryRow } from "@/api/admin";
import { Badge, Button, Input } from "@/components/ui";

interface CatalogueRowProps {
  row: InspectionCategoryRow;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (row: InspectionCategoryRow, direction: -1 | 1) => void;
  onRename: (name: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

/** One catalogue entry: rename in place, reorder, archive or delete if unused. */
export function CatalogueRow({
  row,
  isFirst,
  isLast,
  busy,
  onMove,
  onRename,
  onToggleActive,
  onDelete,
}: CatalogueRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.name);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next.length > 0 && next !== row.name) onRename(next);
    else setDraft(row.name);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${row.name} up`}
          disabled={isFirst || busy}
          onClick={() => onMove(row, -1)}
          className="text-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move ${row.name} down`}
          disabled={isLast || busy}
          onClick={() => onMove(row, 1)}
          className="text-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          ▼
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={draft}
            autoFocus
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(row.name);
                setEditing(false);
              }
            }}
            className="h-9 max-w-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-semibold text-ink hover:text-brand"
          >
            {row.name}
          </button>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {row.usageCount === 0
            ? "Not used on any inspection yet"
            : `Used on ${row.usageCount} inspection${row.usageCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <Badge tone={row.active ? "success" : "neutral"}>{row.active ? "Live" : "Archived"}</Badge>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onToggleActive}>
          {row.active ? "Archive" : "Restore"}
        </Button>
        {row.usageCount === 0 ? (
          <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
CatalogueRow.displayName = "CatalogueRow";
