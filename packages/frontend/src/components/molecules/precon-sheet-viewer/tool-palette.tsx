import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRECON_TOOL_BY_KEY, PRECON_TOOL_GROUPS, PRECON_TOOL_META, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";
import { TOOL_ICONS } from "./tool-icons";
import { ToolPicker } from "./tool-picker";

interface Props {
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  /** Why a built tool cannot be used right now (no sheet, no scale, no line), or null. */
  blockedReasonFor: (meta: PreconToolMeta) => string | null;
  legendOpen: boolean;
  onToggleLegend: () => void;
  /** Tools that are toggles, not drawing modes (Overlay, a sticky Magnifier): their own on/off state. */
  toggles?: Partial<Record<PreconTool, boolean>>;
  /** A blocked tool was chosen: state the reason instead of entering the mode. */
  onBlockedAttempt: (meta: PreconToolMeta, reason: string) => void;
}

const NO_TOGGLES: Partial<Record<PreconTool, boolean>> = {};
const TOTAL_TOOLS = PRECON_TOOL_META.length;

/** "Length · m · L", with the reason appended when the tool is disabled. */
export function toolTooltip(meta: PreconToolMeta, blocked: string | null): string {
  const parts = [meta.label];
  if (meta.unit) parts.push(meta.unit);
  parts.push(meta.shortcut);
  const base = parts.join(" · ");
  return blocked ? `${base} — ${blocked}` : `${base} — ${meta.hint}`;
}

/** Live scroll position of the rail, so an overflow control only shows when it would do something. */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ up: false, down: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setEdges({ up: el.scrollTop > 1, down: el.scrollTop + el.clientHeight < el.scrollHeight - 1 });
    read();
    el.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [ref]);
  return edges;
}

function PaletteButton({ meta, active, blocked, onChoose }: { meta: PreconToolMeta; active: boolean; blocked: string | null; onChoose: () => void }) {
  const Icon = TOOL_ICONS[meta.key];
  return (
    <button
      type="button"
      data-tool-key={meta.key}
      title={toolTooltip(meta, blocked)}
      aria-label={blocked ? `${meta.label} (${meta.shortcut}) — ${blocked}` : `${meta.label} (${meta.shortcut})`}
      aria-pressed={active}
      // aria-disabled, not `disabled`: a blocked tool stays focusable and clickable
      // so it can explain itself; `onChoose` still refuses the mode change.
      aria-disabled={blocked ? true : undefined}
      onClick={onChoose}
      className={cn(
        "relative flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px]",
        active ? "bg-primary-50 font-semibold text-primary-700" : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        // Dim the icon, never the name: `opacity-40` on the button measured 2.5:1 on the label.
        blocked && "cursor-not-allowed font-normal text-ink-muted hover:bg-transparent hover:text-ink-muted",
      )}
    >
      <Icon className={cn("size-4 shrink-0", blocked && "opacity-40")} aria-hidden="true" />
      <span className="w-full text-balance break-words text-center leading-tight">{meta.label}</span>
      {meta.deferred ? (
        <span className="absolute right-0.5 top-0.5 rounded bg-gray-100 px-0.5 text-[8px] font-semibold text-gray-500" aria-hidden="true">
          {meta.deferred}
        </span>
      ) : null}
    </button>
  );
}
PaletteButton.displayName = "PaletteButton";

function RailScrollButton({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  const Icon = dir === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      data-tool-scroll={dir}
      aria-label={dir === "up" ? "Scroll tools up" : "Scroll tools down"}
      onClick={onClick}
      className={cn(
        "flex h-6 shrink-0 items-center justify-center bg-white text-gray-600 hover:bg-gray-100",
        dir === "up" ? "border-b border-line" : "border-t border-line",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
RailScrollButton.displayName = "RailScrollButton";

function PickerTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-tool-picker-trigger="true"
      aria-haspopup="dialog"
      aria-label={`All tools (${TOTAL_TOOLS})`}
      onClick={onOpen}
      className={cn(
        "flex shrink-0 flex-col items-center gap-0.5 border-t border-line px-1 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100",
        className,
      )}
    >
      <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
      <span className="w-full text-balance break-words text-center leading-tight">All tools</span>
    </button>
  );
}
PickerTrigger.displayName = "PickerTrigger";

/**
 * The tool palette. On a wide viewport it is the vertical rail on the left edge
 * of the sheet; the rail is a fixed-height scroller, so it carries explicit
 * scroll controls and a permanently visible scrollbar rather than relying on an
 * overlay scrollbar that paints nothing at rest. Below `lg` the rail could only
 * show a third of its tools, so it collapses to the active tool plus an "All
 * tools" trigger and the canvas keeps the width. Every name is readable in full
 * — long ones wrap, none is ever clipped — and a blocked tool explains itself on
 * click instead of being an inert grey button.
 */
export function ToolPalette({ tool, onToolChange, blockedReasonFor, legendOpen, onToggleLegend, toggles = NO_TOGGLES, onBlockedAttempt }: Props) {
  const railRef = useRef<HTMLElement>(null);
  const edges = useScrollEdges(railRef);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeFor = (meta: PreconToolMeta) => (meta.key === "legend" ? legendOpen : (toggles[meta.key] ?? tool === meta.key));
  const blockedFor = (meta: PreconToolMeta) => (meta.deferred ? `Arrives in ${meta.deferred}` : blockedReasonFor(meta));
  const activate = (meta: PreconToolMeta) => (meta.key === "legend" ? onToggleLegend() : onToolChange(meta.key));
  const choose = (meta: PreconToolMeta) => {
    const blocked = blockedFor(meta);
    if (blocked) return onBlockedAttempt(meta, blocked);
    activate(meta);
  };
  const scrollRail = (direction: 1 | -1) => {
    const el = railRef.current;
    if (el) el.scrollBy({ top: direction * el.clientHeight * 0.8, behavior: "smooth" });
  };

  const selectMeta = PRECON_TOOL_BY_KEY.select;
  const activeMeta = PRECON_TOOL_BY_KEY[tool];

  return (
    <>
      <div data-tool-strip="true" className="flex w-14 shrink-0 flex-col gap-0.5 border-r border-line bg-white px-1 py-1.5 lg:hidden">
        <PaletteButton meta={selectMeta} active={activeFor(selectMeta)} blocked={blockedFor(selectMeta)} onChoose={() => choose(selectMeta)} />
        {tool === "select" ? null : <PaletteButton meta={activeMeta} active blocked={blockedFor(activeMeta)} onChoose={() => choose(activeMeta)} />}
        <PickerTrigger onOpen={() => setPickerOpen(true)} className="mt-auto" />
      </div>

      <div className="hidden w-20 shrink-0 flex-col border-r border-line bg-white lg:flex">
        {edges.up ? <RailScrollButton dir="up" onClick={() => scrollRail(-1)} /> : null}
        <nav ref={railRef} data-tool-rail="true" aria-label="Measuring tools" className="tool-rail-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 py-1.5">
          {PRECON_TOOL_GROUPS.map((group, index) => (
            <div key={group} role="group" aria-label={group} className={cn("flex flex-col gap-0.5", index > 0 && "mt-1 border-t border-line pt-1")}>
              {PRECON_TOOL_META.filter((meta) => meta.group === group).map((meta) => (
                <PaletteButton key={meta.key} meta={meta} active={activeFor(meta)} blocked={blockedFor(meta)} onChoose={() => choose(meta)} />
              ))}
            </div>
          ))}
        </nav>
        {edges.down ? <RailScrollButton dir="down" onClick={() => scrollRail(1)} /> : null}
        <PickerTrigger onOpen={() => setPickerOpen(true)} />
      </div>

      {pickerOpen ? (
        <ToolPicker activeFor={activeFor} blockedFor={blockedFor} onActivate={activate} onBlockedAttempt={onBlockedAttempt} onClose={() => setPickerOpen(false)} />
      ) : null}
    </>
  );
}
ToolPalette.displayName = "ToolPalette";
