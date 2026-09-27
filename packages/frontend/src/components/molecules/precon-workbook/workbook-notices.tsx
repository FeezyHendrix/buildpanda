import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import type { BlockedEdit } from "./protected";
import type { ConflictReport } from "./save-plan";
import type { NarrowNote } from "./snapshot-io";
import type { WorkbookReviewRollup } from "@/api/workbook-types";

/**
 * Everything the grid would not let through, each naming the worksheet, the
 * cell and the reason.
 *
 * It lists rather than summarises because the user has to go and fix each one,
 * and it exists at all because the alternative — dropping the offending cells
 * and saving the rest — would report a success for a document half of which
 * was discarded.
 */
export function RefusalPanel({
  blocked,
  notes,
  onGoTo,
  onDismiss,
}: {
  blocked: readonly BlockedEdit[];
  notes: readonly NarrowNote[];
  onGoTo: (sheetId: string, row: number, column: number) => void;
  onDismiss: () => void;
}) {
  const total = blocked.length + notes.length;
  if (total === 0) return null;

  return (
    <div className="border-b border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700" role="alert">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          {total === 1 ? "One change was not saved" : `${total} changes were not saved`} — nothing else was saved either.
        </p>
        <Button size="sm" variant="ghost" className="-my-1 h-6 shrink-0 px-2 text-error-700" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <ul className="mt-1 space-y-0.5">
        {blocked.map((edit) => (
          <li key={`${edit.sheetId}-${edit.row}-${edit.column}`}>
            <button
              type="button"
              className="text-left underline decoration-error-300 underline-offset-2 hover:decoration-error-700"
              onClick={() => onGoTo(edit.sheetId, edit.row, edit.column)}
            >
              {edit.sheetLabel} · row {edit.row + 1}
            </button>{" "}
            — {edit.reason}
          </li>
        ))}
        {notes.map((note) => (
          <li key={`${note.sheetId}-${note.row}-${note.column}`}>
            <button
              type="button"
              className="text-left underline decoration-error-300 underline-offset-2 hover:decoration-error-700"
              onClick={() => onGoTo(note.sheetId, note.row, note.column)}
            >
              row {note.row + 1}, column {note.column + 1}
            </button>{" "}
            — {note.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
RefusalPanel.displayName = "RefusalPanel";

/**
 * A save that did not land, and what to do about it.
 *
 * Shown for every failure the refusal list does not already explain — a dropped
 * connection, a cycle, a busy calculator. It carries Retry rather than telling
 * the user to find the Save button, and retrying reuses the same operation id,
 * so a save that actually landed before the answer was lost is answered from
 * its original receipt instead of being applied twice.
 */
export function SaveFailureBanner({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700"
      role="alert"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{message}</span> Your work is still here.
      </p>
      <Button size="sm" variant="secondary" className="shrink-0" loading={retrying} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
SaveFailureBanner.displayName = "SaveFailureBanner";

/**
 * A 409: the workbook moved under this draft.
 *
 * Nothing is resolved automatically. The two outcomes are named as what they
 * cost — discarding YOUR work, or discarding THEIRS — and neither happens until
 * the user picks one. The draft is intact throughout.
 */
export function ConflictPanel({
  report,
  onDiscardMine,
  onKeepMine,
  busy,
}: {
  report: ConflictReport;
  onDiscardMine: () => void;
  onKeepMine: () => void;
  busy: boolean;
}) {
  return (
    <div className="border-b border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-800" role="alert">
      <p className="font-semibold">
        Someone else saved this workbook{report.at ? ` at ${new Date(report.at).toLocaleTimeString()}` : ""}. It is now
        version {report.toVersion}.
      </p>
      <p className="mt-0.5">
        {report.sourcesMoved
          ? "A measured figure moved as well, so some quantities here are out of date."
          : "Your work is still here. Choose which version to keep."}
      </p>

      {report.lines.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-md border border-warning-100 bg-surface">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-line-hair px-2 py-1 text-[11px] font-semibold text-black-300">
            <span>Cell</span>
            <span>Yours</span>
            <span>Theirs</span>
          </div>
          {report.lines.map((line) => (
            <div
              key={line.label}
              className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-line-hair px-2 py-1 text-[11px] text-ink last:border-b-0"
            >
              <span className="truncate text-black-300">{line.label}</span>
              <span className="font-mono">{line.mine}</span>
              <span className="font-mono text-black-300">{line.theirs}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onDiscardMine} disabled={busy}>
          Discard mine, load theirs
        </Button>
        <Button size="sm" variant="primary" onClick={onKeepMine} loading={busy}>
          Keep mine, save over theirs
        </Button>
      </div>
    </div>
  );
}
ConflictPanel.displayName = "ConflictPanel";

/**
 * Whether the figures this workbook is built on can be relied on. Reading a
 * workbook verifies nothing, so this reports and never confers.
 */
export function ReviewBanner({ rollup, stale }: { rollup: WorkbookReviewRollup; stale: boolean }) {
  const parts: string[] = [];
  if (rollup.needsReview > 0) parts.push(`${rollup.needsReview} need review`);
  if (rollup.unreviewed > 0) parts.push(`${rollup.unreviewed} not yet looked at`);
  if (rollup.missingBasis > 0) parts.push(`${rollup.missingBasis} without a recorded basis`);
  if (rollup.stated > 0) parts.push(`${rollup.stated} entered by hand`);
  if (rollup.withdrawn > 0) parts.push(`${rollup.withdrawn} withdrawn`);
  if (parts.length === 0 && !stale) return null;

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-3 py-1 text-[11px]",
        stale ? "border-warning-100 bg-warning-50 text-warning-800" : "border-line bg-surface-alt text-ink-muted",
      )}
    >
      {stale ? <span className="font-semibold">Quantities have moved since this was last saved.</span> : null}
      {parts.length > 0 ? (
        <span>
          Of {rollup.boundRows} priced {rollup.boundRows === 1 ? "line" : "lines"}: {parts.join(", ")}.
        </span>
      ) : null}
    </p>
  );
}
ReviewBanner.displayName = "ReviewBanner";
