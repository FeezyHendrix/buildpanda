import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRECON_TOOL_GROUPS, PRECON_TOOL_META, type PreconToolMeta } from "@/lib/precon-meta";
import { TOOL_ICONS } from "./tool-icons";

interface Props {
  /** Whether a tool reads as on right now (active mode, or a toggle that is on). */
  activeFor: (meta: PreconToolMeta) => boolean;
  /** Why a tool cannot be used right now, or null. */
  blockedFor: (meta: PreconToolMeta) => string | null;
  onActivate: (meta: PreconToolMeta) => void;
  /** A blocked tool was chosen: show the reason instead of entering the mode. */
  onBlockedAttempt: (meta: PreconToolMeta, reason: string) => void;
  onClose: () => void;
}

function ToolRow({ meta, active, blocked, onChoose }: { meta: PreconToolMeta; active: boolean; blocked: string | null; onChoose: () => void }) {
  const Icon = TOOL_ICONS[meta.key];
  return (
    <button
      type="button"
      data-tool-key={meta.key}
      data-picker-item="true"
      aria-pressed={active}
      aria-disabled={blocked ? true : undefined}
      onClick={onChoose}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
        active ? "bg-primary-50" : "hover:bg-gray-100",
        blocked && "cursor-not-allowed",
      )}
    >
      <Icon className={cn("size-4 shrink-0", blocked ? "opacity-40" : "text-gray-600")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px]", active ? "font-semibold text-primary-700" : blocked ? "font-normal text-ink-muted" : "font-medium text-ink")}>
          {meta.label}
          {meta.unit ? <span className="font-normal text-ink-muted"> · {meta.unit}</span> : null}
        </span>
        <span className="block text-[11px] leading-tight text-ink-muted">{blocked ?? meta.hint}</span>
      </span>
      <kbd className="shrink-0 rounded border border-line bg-surface-alt px-1 text-[10px] font-semibold text-ink-muted">{meta.shortcut}</kbd>
    </button>
  );
}
ToolRow.displayName = "ToolRow";

/**
 * Every tool in one labelled, scrollable list. This is the palette's escape
 * hatch: the rail is a fixed-height scroller, so on a short or narrow viewport
 * most names are off-screen — here all 18 are readable, grouped, with the
 * reason a blocked one cannot run stated on the row itself.
 */
export function ToolPicker({ activeFor, blockedFor, onActivate, onBlockedAttempt, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("[data-picker-item]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="All tools"
        data-tool-picker="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-drawer sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">All tools</h2>
          <button type="button" aria-label="Close all tools" onClick={onClose} className="rounded-lg p-1 text-gray-600 hover:bg-gray-100">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div data-tool-picker-scroll="true" className="tool-rail-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {PRECON_TOOL_GROUPS.map((group) => (
            <div key={group} role="group" aria-label={group} className="pb-1">
              <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold capitalize text-black-300">{group}</p>
              {PRECON_TOOL_META.filter((meta) => meta.group === group).map((meta) => {
                const blocked = blockedFor(meta);
                return (
                  <ToolRow
                    key={meta.key}
                    meta={meta}
                    active={activeFor(meta)}
                    blocked={blocked}
                    onChoose={() => {
                      if (blocked) return onBlockedAttempt(meta, blocked);
                      onActivate(meta);
                      onClose();
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
ToolPicker.displayName = "ToolPicker";
