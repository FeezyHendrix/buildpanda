import { Download, Plus, Redo2, Table2, Undo2 } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

export type SaveState = "clean" | "dirty" | "saving" | "failed" | "conflict";

const STATUS: Readonly<Record<SaveState, { label: string; dot: string; text: string }>> = {
  clean: { label: "Saved", dot: "bg-success-500", text: "text-ink-muted" },
  dirty: { label: "Unsaved changes", dot: "bg-warning-500", text: "text-warning-700" },
  // Never "Saved" while a calculation is still running.
  saving: { label: "Saving…", dot: "bg-primary-500", text: "text-ink-muted" },
  failed: { label: "Not saved", dot: "bg-error-500", text: "text-error-600" },
  conflict: { label: "Needs your decision", dot: "bg-warning-500", text: "text-warning-700" },
};

export function SaveStatus({ state, version }: { state: SaveState; version: number }) {
  const status = STATUS[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px]", status.text)} role="status">
      <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden="true" />
      {status.label}
      {version > 0 && state === "clean" ? <span className="text-black-200">· v{version}</span> : null}
    </span>
  );
}
SaveStatus.displayName = "SaveStatus";

interface Props {
  state: SaveState;
  version: number;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  sheetCount: number;
  onExport: () => void;
  onSave: () => void;
  onAddSheet: () => void;
  onOpenSheets: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * The compact strip above the grid.
 *
 * Deliberately small: the spreadsheet's own formula bar and tabs do the
 * spreadsheet work, so this only carries what BuildPanda owns — saving to the
 * take-off, the audited undo, adding a working sheet, and the export.
 */
export function WorkbookToolbar({
  state,
  version,
  canSave,
  canUndo,
  canRedo,
  exporting,
  sheetCount,
  onExport,
  onSave,
  onAddSheet,
  onOpenSheets,
  onUndo,
  onRedo,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
      <SaveStatus state={state} version={version} />

      <div className="ml-auto flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 px-0"
          title="Undo the last saved change"
          aria-label="Undo the last saved change"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 px-0"
          title="Redo"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 className="size-3.5" aria-hidden="true" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={onOpenSheets}
          title="All worksheets"
          aria-label={`All worksheets (${sheetCount})`}
        >
          <Table2 className="size-3.5" aria-hidden="true" />
          <span className="max-sm:sr-only">Sheets</span>
        </Button>

        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onAddSheet} title="Add a working worksheet">
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="max-sm:sr-only">Add sheet</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={onExport}
          loading={exporting}
          title="Download this workbook as an Excel file"
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span className="max-sm:sr-only">Export</span>
        </Button>

        <Button size="sm" variant="primary" disabled={!canSave} loading={state === "saving"} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
WorkbookToolbar.displayName = "WorkbookToolbar";
