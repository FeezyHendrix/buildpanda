import { Columns2, Lock, Unlock, X } from "lucide-react";
import type { Sheet } from "./plan-review-data";
import { SheetPane } from "./plan-review-sheet-pane";
import { PANE, POPOVER, type PopoverId } from "./plan-review-types";
import { IconBtn } from "./plan-review-ui";
import type { SheetNavigationController } from "./use-sheet-navigation";

interface PlanReviewSplitProps {
  sheets: Sheet[];
  nav: SheetNavigationController;
  popover: { open: PopoverId | null; onOpen: (id: PopoverId | null) => void };
}

/**
 * Side-by-side compare: two independently driven sheet panes with a draggable
 * divider. The compare pane can be locked to its sheet and the panes' zoom
 * synced, so a reviewer holds one drawing steady while walking the other.
 */
export function PlanReviewSplit({ sheets, nav, popover }: PlanReviewSplitProps) {
  const split = nav.split;
  return (
    <div ref={nav.splitStageRef} className="flex min-h-0 flex-1 flex-col gap-2 bg-[#F0F0F0] p-3 md:flex-row md:gap-0">
      <div className="flex min-h-0 min-w-0 flex-1 md:flex-none" style={{ flexBasis: `${split.dividerRatio * 100}%` }}>
        <SheetPane
          paneKey="primary"
          label="Primary"
          sheets={sheets}
          sheetIndex={split.primaryIndex}
          zoom={split.primaryZoom}
          locked={false}
          optionsOpen={popover.open === POPOVER.PANE_OPTS_PRIMARY}
          onToggleOptions={() => popover.onOpen(popover.open === POPOVER.PANE_OPTS_PRIMARY ? null : POPOVER.PANE_OPTS_PRIMARY)}
          onSheetChange={(index) => nav.setSplit((s) => ({ ...s, primaryIndex: index }))}
          onZoomChange={(nextZoom) => nav.setPaneZoom(PANE.PRIMARY, nextZoom)}
          onFit={() => {
            nav.setSplit((s) => ({ ...s, primaryZoom: 100, compareZoom: s.synced ? 100 : s.compareZoom }));
            popover.onOpen(null);
          }}
        />
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        onMouseDown={nav.startDividerDrag}
        className="hidden w-2 shrink-0 cursor-col-resize flex-col items-center justify-center gap-2 md:flex"
      >
        <span className="h-16 w-1 rounded-full bg-gray-300" />
      </div>
      <div className="flex items-center justify-center gap-2 md:hidden">
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <SheetPane
          paneKey="compare"
          label="Compare"
          sheets={sheets}
          sheetIndex={split.compareIndex}
          zoom={split.compareZoom}
          locked={split.locked}
          optionsOpen={popover.open === POPOVER.PANE_OPTS_COMPARE}
          onToggleOptions={() => popover.onOpen(popover.open === POPOVER.PANE_OPTS_COMPARE ? null : POPOVER.PANE_OPTS_COMPARE)}
          onSheetChange={(index) => nav.setSplit((s) => ({ ...s, compareIndex: index }))}
          onZoomChange={(nextZoom) => nav.setPaneZoom(PANE.COMPARE, nextZoom)}
          onFit={() => {
            nav.setSplit((s) => ({ ...s, compareZoom: 100, primaryZoom: s.synced ? 100 : s.primaryZoom }));
            popover.onOpen(null);
          }}
        />
      </div>

      <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
        <IconBtn
          label={split.locked ? "Unlock compare pane" : "Lock compare pane"}
          pressed={split.locked}
          active={split.locked}
          onClick={() => nav.setSplit((s) => ({ ...s, locked: !s.locked }))}
          className="size-7"
        >
          {split.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </IconBtn>
        <IconBtn
          label={split.synced ? "Disable zoom sync" : "Sync zoom across panes"}
          pressed={split.synced}
          active={split.synced}
          onClick={() =>
            nav.setSplit((s) => ({ ...s, synced: !s.synced, compareZoom: !s.synced ? s.primaryZoom : s.compareZoom }))
          }
          className="size-7"
        >
          <Columns2 size={13} />
        </IconBtn>
        <button
          type="button"
          aria-label="Exit Split View"
          title="Exit Split View"
          onClick={() => nav.setSplit((s) => ({ ...s, open: false }))}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
        >
          <X size={13} /> Exit Split View
        </button>
      </div>
    </div>
  );
}

PlanReviewSplit.displayName = "PlanReviewSplit";
