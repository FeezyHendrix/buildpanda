import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Ruler,
  Search,
  Sparkles,
  Star,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Sheet } from "./plan-review-data";
import { CALIBRATED_LABEL, KEY, POPOVER, REVISIONS, type Note, type PopoverId } from "./plan-review-types";
import { IconBtn, Kbd, POP_ITEM_CLS, PopShell } from "./plan-review-ui";

interface SheetSearchResult extends Sheet {
  index: number;
}

interface HeaderSearch {
  query: string;
  trimmed: string;
  onQueryChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  sheetResults: readonly SheetSearchResult[];
  noteResults: readonly Note[];
  resultCount: number;
  sheetCodeFor: (sheetId: string) => string;
  onGoToSheet: (index: number) => void;
  onGoToSheetById: (sheetId: string) => void;
}

interface WorkspaceHeaderProps {
  sheet: Sheet;
  currentRevision: string;
  scaleLabel: string | undefined;
  popover: { open: PopoverId | null; onOpen: (id: PopoverId | null) => void };
  nav: { activeIndex: number; count: number; onGo: (index: number) => void };
  revision: { onSelect: (rev: string) => void };
  favorite: { active: boolean; onToggle: () => void };
  markupVisible: boolean;
  onToggleMarkup: () => void;
  compare: { can: boolean; onBlend: () => void; splitOpen: boolean; onToggleSplit: () => void };
  search: HeaderSearch;
  onRecordStart: () => void;
  onExit: () => void;
}

/** Top navigation bar for the Drawing Review Workspace: sheet identity, revision, search, and the review-tools menu. */
export function WorkspaceHeader({
  sheet,
  currentRevision,
  scaleLabel,
  popover,
  nav,
  revision,
  favorite,
  markupVisible,
  onToggleMarkup,
  compare,
  search,
  onRecordStart,
  onExit,
}: WorkspaceHeaderProps) {
  const revisionOptions = sheet.scale ? REVISIONS : [currentRevision];
  return (
    <header className="relative z-40 flex shrink-0 items-center gap-2 border-b border-[#F0F0F0] bg-white px-3 py-2">
      <button
        type="button"
        onClick={onExit}
        title="Exit document review"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
      >
        <X size={15} /> Exit
      </button>
      <div className="flex items-center">
        <IconBtn label="Previous sheet" disabled={nav.activeIndex === 0} onClick={() => nav.onGo(nav.activeIndex - 1)}>
          <ChevronLeft size={17} />
        </IconBtn>
        <IconBtn label="Next sheet" disabled={nav.activeIndex === nav.count - 1} onClick={() => nav.onGo(nav.activeIndex + 1)}>
          <ChevronRight size={17} />
        </IconBtn>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <FileText size={15} className="shrink-0 text-gray-400" />
        <span className="truncate text-sm font-semibold text-gray-900">
          {sheet.code} · {sheet.title}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-500 sm:flex">
          {currentRevision}
          {sheet.scale ? ` · ${sheet.scale}` : ""}
          {!sheet.scale && scaleLabel === CALIBRATED_LABEL && (
            <span className="flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">
              <Ruler size={10} /> Calibrated
            </span>
          )}
          {!sheet.scale && scaleLabel && scaleLabel !== CALIBRATED_LABEL && (
            <span className="flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">
              <Sparkles size={10} /> {scaleLabel} from sheet
            </span>
          )}
          {!sheet.scale && !scaleLabel && (
            <span className="flex items-center gap-1 rounded bg-[#F6F6F6] px-1.5 py-0.5 text-gray-500">
              No scale on sheet — measure, then Calibrate
            </span>
          )}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="relative">
          <button
            type="button"
            data-popover-trigger
            aria-haspopup="true"
            aria-expanded={popover.open === POPOVER.REVISION}
            title="Select revision"
            onClick={() => popover.onOpen(popover.open === POPOVER.REVISION ? null : POPOVER.REVISION)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
          >
            {currentRevision} <ChevronDown size={12} />
          </button>
          {popover.open === POPOVER.REVISION && (
            <PopShell className="right-0 w-36">
              {revisionOptions.map((rev) => (
                <button
                  key={rev}
                  type="button"
                  onClick={() => revision.onSelect(rev)}
                  className={cn(POP_ITEM_CLS, "justify-between")}
                >
                  {rev}
                  {rev === currentRevision ? <Check size={14} className="text-primary-600" /> : null}
                </button>
              ))}
            </PopShell>
          )}
        </div>

        <IconBtn
          label={favorite.active ? "Remove from favorites" : "Add to favorites"}
          pressed={favorite.active}
          onClick={favorite.onToggle}
          className={favorite.active ? "text-amber-500 hover:text-amber-500" : undefined}
        >
          <Star size={16} fill={favorite.active ? "currentColor" : "none"} />
        </IconBtn>

        <div className="relative">
          <IconBtn
            label="Search sheets and notes (/)"
            data-popover-trigger
            hasPopup
            expanded={popover.open === POPOVER.SEARCH}
            onClick={() => popover.onOpen(popover.open === POPOVER.SEARCH ? null : POPOVER.SEARCH)}
          >
            <Search size={16} />
          </IconBtn>
          {popover.open === POPOVER.SEARCH && (
            <PopShell className="right-0 w-80 p-3">
              <div className="flex items-center gap-2 rounded-lg bg-[#F6F6F6] px-2.5 py-2">
                <Search size={14} className="shrink-0 text-gray-400" />
                <input
                  ref={search.inputRef}
                  value={search.query}
                  onChange={(e) => search.onQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === KEY.ESCAPE) {
                      search.onQueryChange("");
                      popover.onOpen(null);
                    }
                  }}
                  aria-label="Search sheets and markup"
                  placeholder="Search sheets and markup"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
                <Kbd>Esc</Kbd>
              </div>
              {!search.trimmed ? (
                <p className="px-1 pt-3 text-xs text-gray-400">Search sheets and markup</p>
              ) : search.resultCount === 0 ? (
                <p className="px-1 pt-3 text-xs text-gray-500">No results for &ldquo;{search.trimmed}&rdquo;</p>
              ) : (
                <div className="max-h-72 overflow-y-auto pt-2">
                  <p className="px-1 pb-1 text-[11px] text-gray-500">
                    {search.resultCount} result{search.resultCount === 1 ? "" : "s"}
                  </p>
                  {search.sheetResults.length > 0 && (
                    <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sheets</p>
                  )}
                  {search.sheetResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        search.onGoToSheet(s.index);
                        popover.onOpen(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                    >
                      <FileText size={13} className="shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-900">{s.code}</span>
                      <span className="truncate text-gray-500">{s.title}</span>
                    </button>
                  ))}
                  {search.noteResults.length > 0 && (
                    <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Markup &amp; Notes
                    </p>
                  )}
                  {search.noteResults.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        search.onGoToSheetById(n.sheetId);
                        popover.onOpen(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                    >
                      <MessageSquare size={13} className="shrink-0 text-gray-400" />
                      <span className="truncate text-gray-600">{n.text}</span>
                      <span className="ml-auto shrink-0 text-gray-400">{search.sheetCodeFor(n.sheetId)}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopShell>
          )}
        </div>

        <IconBtn label={markupVisible ? "Hide all markup" : "Show all markup"} pressed={markupVisible} onClick={onToggleMarkup}>
          {markupVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </IconBtn>

        <div className="relative">
          <button
            type="button"
            data-popover-trigger
            aria-haspopup="true"
            aria-expanded={popover.open === POPOVER.REVIEW_TOOLS}
            title="Review tools"
            onClick={() => popover.onOpen(popover.open === POPOVER.REVIEW_TOOLS ? null : POPOVER.REVIEW_TOOLS)}
            className="flex items-center gap-1.5 rounded-lg border border-[#EDEDED] bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-[#F6F6F6]"
          >
            <span className="hidden sm:inline">Review Tools</span>
            <MoreHorizontal size={16} className="sm:hidden" />
            <ChevronDown size={13} className="hidden sm:inline" />
          </button>
          {popover.open === POPOVER.REVIEW_TOOLS && (
            <PopShell className="right-0 w-56">
              {compare.can && (
                <button type="button" onClick={compare.onBlend} className={POP_ITEM_CLS}>
                  <Layers size={15} /> Compare Revisions
                </button>
              )}
              {compare.can && (
                <button type="button" onClick={compare.onToggleSplit} className={POP_ITEM_CLS}>
                  <Columns2 size={15} /> {compare.splitOpen ? "Exit Split View" : "Split View"}
                </button>
              )}
              <button type="button" onClick={onRecordStart} className={POP_ITEM_CLS}>
                <Video size={15} /> Record Walkthrough
              </button>
              <button type="button" onClick={onToggleMarkup} className={POP_ITEM_CLS}>
                {markupVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                {markupVisible ? "Hide Markup" : "Show Markup"}
              </button>
            </PopShell>
          )}
        </div>
      </div>
    </header>
  );
}
