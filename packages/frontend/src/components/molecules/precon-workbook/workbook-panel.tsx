import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { workbookApi } from "@/api/workbook";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { useSavedUndo } from "./use-saved-undo";
import { CellInspector } from "./cell-inspector";
import { SheetPicker } from "./sheet-picker";
import { bindingAt, sourceActionFor, type SourceAction } from "./source-action";
import { useWorkbookEditor } from "./use-workbook-editor";
import { ConflictPanel, RefusalPanel, ReviewBanner, SaveFailureBanner } from "./workbook-notices";
import { WorkbookGrid } from "./workbook-grid";
import { WorkbookToolbar } from "./workbook-toolbar";
import type { WorkbookEngine } from "./univer-engine";

// Below `lg` the workspace stacks into a scrolling column, where `flex-1`
// resolves to zero and the engine renders into a 0px canvas. The fixed height
// is what keeps the grid a grid on a phone — as `VIEWER_SHELL` does for the sheet.
const WORKBOOK_SHELL =
  "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface " +
  "max-lg:h-[34rem] max-lg:flex-none";

export interface WorkbookPanelProps {
  sessionId: string;
  /** False while the drawings pane has the screen; the editor keeps its draft either way. */
  active: boolean;
  /** Narrow viewport: the cell editor docks above the keyboard. */
  compact: boolean;
  onSourceAction: (action: SourceAction) => void;
  /** Raised while the grid owns the keyboard, so canvas shortcuts stand down. */
  onFocusWithin: (focused: boolean) => void;
}

/**
 * The workbook: a real spreadsheet over the take-off's own bill.
 *
 * It is mounted once and kept mounted. Switching to the drawings hides it
 * rather than unmounting it, because unmounting would throw away both the
 * engine and any unsaved work in it — and the whole point of the mode control
 * is that a person can look at the drawing their figure came from without
 * losing the formula they were halfway through.
 */
export function WorkbookPanel({ sessionId, active, compact, onSourceAction, onFocusWithin }: WorkbookPanelProps) {
  const editor = useWorkbookEditor(sessionId, true);
  const [picking, setPicking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  const document = editor.document;
  const undo = useSavedUndo(sessionId, document, editor.adoptWholeDocument);
  // Read at mount time only, so `onReady` does not have to depend on it.
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const layout = document?.layout;

  const sheetLabel = useMemo(() => {
    const id = editor.focus?.sheetId ?? activeSheetId;
    return layout?.sheets.find((sheet) => sheet.sheetId === id)?.label ?? "Workbook";
  }, [layout, editor.focus?.sheetId, activeSheetId]);

  // The description as the GRID shows it, so a line renamed in this draft is
  // named by what the user can see rather than by what the server last stored.
  const describe = useCallback(
    (sheetId: string, row: number): string => {
      const sheet = layout?.sheets.find((entry) => entry.sheetId === sheetId);
      const column = sheet ? Object.entries(sheet.columns).find(([, field]) => field === "description")?.[0] : null;
      if (!sheet || column === null || column === undefined) return "";
      const cell = document?.snapshot.sheets[sheetId]?.cellData[String(row)]?.[column];
      return typeof cell?.v === "string" ? cell.v : "";
    },
    [layout, document],
  );

  const binding = useMemo(
    () => (layout ? bindingAt(layout, editor.focus?.sheetId ?? null, editor.focus?.row ?? -1, describe) : null),
    [layout, editor.focus, describe],
  );
  const action = useMemo(() => sourceActionFor(binding), [binding]);
  /** How many things the refusal list has to show. Zero means it renders nothing. */
  const refusals = (editor.candidate?.blocked.length ?? 0) + (editor.candidate?.notes.length ?? 0);
  const showFailure =
    refusals === 0 &&
    editor.failureMessage !== null &&
    (editor.state === "failed" || editor.state === "saving");

  useEffect(() => {
    if (active) editor.restoreContext();
    else editor.rememberContext();
    // Only the visibility flip matters; the editor's callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const attachEngine = editor.attachEngine;
  const getEngine = editor.engine;

  const onReady = useCallback(
    (engine: WorkbookEngine) => {
      attachEngine(engine);
      setActiveSheetId(engine.activeSheetId());
      void engine.applyColumnPresentation(compactRef.current);
    },
    [attachEngine],
  );

  useEffect(() => {
    void getEngine()?.applyColumnPresentation(compact);
  }, [compact, getEngine]);

  const runExport = useCallback(() => {
    setExporting(true);
    workbookApi
      .exportXlsx(sessionId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = `takeoff-workbook-${sessionId}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) =>
        toast(getApiErrorMessage(error, "The workbook could not be exported."), "error"),
      )
      .finally(() => setExporting(false));
  }, [sessionId]);

  const goTo = useCallback(
    (sheetId: string, row: number, column: number) => {
      editor.engine()?.focus(sheetId, row, column);
      setActiveSheetId(sheetId);
    },
    [editor],
  );

  if (editor.loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-line bg-surface">
        <Spinner size="md" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-line bg-surface p-6">
        <EmptyState
          title="Workbook unavailable"
          description={getApiErrorMessage(editor.error, "This take-off's workbook could not be opened.")}
        />
      </div>
    );
  }

  return (
    <section
      aria-label="Take-off workbook"
      className={WORKBOOK_SHELL}
      onFocusCapture={() => onFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFocusWithin(false);
      }}
      onPointerDownCapture={() => onFocusWithin(true)}
    >
      <WorkbookToolbar
        state={editor.state}
        version={document.version}
        canSave={editor.state === "dirty" || editor.state === "failed"}
        // Saved undo replaces the whole document, so it is offered only with a
        // clean grid: reversing under a draft would silently discard the draft.
        canUndo={undo.undoTarget !== null && !undo.busy && editor.state === "clean"}
        canRedo={undo.redoTarget !== null && !undo.busy && editor.state === "clean"}
        exporting={exporting}
        sheetCount={layout?.sheets.length ?? 0}
        onExport={runExport}
        onSave={() => void editor.save()}
        onAddSheet={() => editor.engine()?.addScratchSheet(`Working ${(layout?.sheets.length ?? 0) + 1}`)}
        onOpenSheets={() => setPicking(true)}
        onUndo={() => undo.undoTarget && undo.run(undo.undoTarget)}
        onRedo={() => undo.redoTarget && undo.run(undo.redoTarget)}
      />

      {editor.conflict ? (
        <ConflictPanel
          report={editor.conflict}
          busy={editor.state === "saving"}
          onDiscardMine={editor.discardMine}
          onKeepMine={() => void editor.keepMine()}
        />
      ) : null}

      {refusals > 0 && editor.candidate ? (
        <RefusalPanel
          blocked={editor.candidate.blocked}
          notes={editor.candidate.notes}
          onGoTo={goTo}
          onDismiss={editor.clearRefusals}
        />
      ) : null}

      {/* The complement of the list above, never both. `candidate` is set on
          EVERY save attempt, so gating on it hid this banner for every failure
          that had nothing to list — a dropped connection, a cycle. It stays up
          through the retry so the reason does not flicker away mid-press. */}
      {showFailure ? (
        <SaveFailureBanner
          message={editor.failureMessage ?? ""}
          retrying={editor.state === "saving"}
          onRetry={() => void editor.save()}
        />
      ) : null}

      {editor.heldBack ? (
        <p className="border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-primary-800" role="status">
          This take-off has moved since you started editing. Save your work, or discard it, to pick up the new figures.
        </p>
      ) : null}

      {editor.refusal ? (
        <p className="border-b border-warning-100 bg-warning-50 px-3 py-1.5 text-xs text-warning-800" role="status">
          {editor.refusal.reason}
        </p>
      ) : null}

      <ReviewBanner rollup={document.reviewRollup} stale={document.reviewRollup.sourcesMoved} />

      {!compact ? (
        <CellInspector
          focus={editor.focus}
          sheetLabel={sheetLabel}
          binding={binding}
          action={action}
          docked={false}
          onCommit={(text) => {
            const focus = editor.focus;
            if (focus) editor.engine()?.setCellText(focus.sheetId, focus.row, focus.column, text);
          }}
          onSourceAction={onSourceAction}
        />
      ) : null}

      <WorkbookGrid
        key={`${sessionId}-${editor.gridKey}`}
        document={document}
        layout={editor.layout}
        onReady={onReady}
        callbacks={{
          onDirty: editor.markDirty,
          onRefused: (refusal) => {
            editor.setRefusal(refusal);
            window.setTimeout(() => editor.setRefusal(null), 6000);
          },
          onFocusChanged: (focus) => {
            editor.setFocus(focus);
            if (focus) setActiveSheetId(focus.sheetId);
          },
        }}
      />

      {compact ? (
        <CellInspector
          focus={editor.focus}
          sheetLabel={sheetLabel}
          binding={binding}
          action={action}
          docked
          onCommit={(text) => {
            const focus = editor.focus;
            if (focus) editor.engine()?.setCellText(focus.sheetId, focus.row, focus.column, text);
          }}
          onSourceAction={onSourceAction}
        />
      ) : null}

      {picking && layout ? (
        <SheetPicker
          layout={layout}
          activeSheetId={activeSheetId}
          onSelect={(sheetId) => {
            editor.engine()?.setActiveSheet(sheetId);
            setActiveSheetId(sheetId);
          }}
          onDelete={(sheetId) => editor.engine()?.deleteScratchSheet(sheetId)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </section>
  );
}
WorkbookPanel.displayName = "WorkbookPanel";
