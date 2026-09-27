// Which panes the workspace shows, and why it sometimes shows fewer than were
// asked for.
//
// The rule the plan fixes: Split is only offered when BOTH panes get a width
// they can actually be worked in — 440px for the workbook, 480px for the
// drawing. Below that the requested mode is REMEMBERED and one pane is shown,
// so widening the window (or turning a tablet) restores the split without the
// user having to ask for it again. Silently rewriting the request to
// "workbook" would lose that.

export const WORKBOOK_MODES = ["workbook", "drawings", "split"] as const;
export type WorkspaceMode = (typeof WORKBOOK_MODES)[number];

/** Narrower than this and a spreadsheet is a column of clipped numbers. */
export const MIN_WORKBOOK_WIDTH = 440;
/** Narrower than this and a drawing cannot be measured on. */
export const MIN_DRAWING_WIDTH = 480;
/** The `gap-4` between the two panes. */
export const PANE_GAP = 16;

export const MIN_SPLIT_WIDTH = MIN_WORKBOOK_WIDTH + MIN_DRAWING_WIDTH + PANE_GAP;

/**
 * Below this the workbook folds its columns and docks its cell editor. Set at
 * the workbook's own minimum, so a pane that is merely small is not treated as
 * a phone — a split pane at exactly `MIN_WORKBOOK_WIDTH` keeps the full layout.
 */
export const COMPACT_WORKBOOK_WIDTH = MIN_WORKBOOK_WIDTH;

export function canSplit(availableWidth: number): boolean {
  return availableWidth >= MIN_SPLIT_WIDTH;
}

export interface ResolvedMode {
  readonly showWorkbook: boolean;
  readonly showDrawings: boolean;
  /** True when Split was asked for but there is not room for it. */
  readonly splitCollapsed: boolean;
}

/** Which single pane a split collapses to when there is not room for two. */
export type CollapsePreference = "workbook" | "drawings";

/**
 * What to render. `requested` is never mutated by this — the caller keeps it,
 * so the split comes back the moment there is room.
 *
 * `availableWidth` is the whole workspace container, measured once and
 * independent of mode: in a split the panes get all of it, because the bill
 * panel is the drawing's companion and is off screen then.
 */
export function resolveMode(
  requested: WorkspaceMode,
  availableWidth: number,
  hasDrawings: boolean,
  collapseTo: CollapsePreference = "workbook",
): ResolvedMode {
  if (!hasDrawings) return { showWorkbook: true, showDrawings: false, splitCollapsed: false };
  if (requested === "split") {
    if (canSplit(availableWidth)) return { showWorkbook: true, showDrawings: true, splitCollapsed: false };
    // Someone who pressed Remeasure wants the drawing; otherwise the workbook.
    return {
      showWorkbook: collapseTo === "workbook",
      showDrawings: collapseTo === "drawings",
      splitCollapsed: true,
    };
  }
  return {
    showWorkbook: requested === "workbook",
    showDrawings: requested === "drawings",
    splitCollapsed: false,
  };
}

/**
 * The mode a take-off opens in.
 *
 * An automatic take-off has already produced a priced bill, so the workbook is
 * where the work is. A manual take-off has nothing in it yet — its quantities
 * come from drawing on a sheet — so it opens where those are made.
 */
export function defaultModeFor(takeoffKind: string): WorkspaceMode {
  return takeoffKind === "manual" ? "drawings" : "workbook";
}
