import { cn } from "@/lib/utils";
import { PRECON_TOOL_GROUPS, PRECON_TOOL_META, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";
import { TOOL_ICONS } from "./tool-icons";

interface Props {
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  /** Why a built tool cannot be used right now (no sheet, no scale, no line), or null. */
  blockedReasonFor: (meta: PreconToolMeta) => string | null;
  legendOpen: boolean;
  onToggleLegend: () => void;
}

/** "Length · m · L", with the reason appended when the tool is disabled. */
export function toolTooltip(meta: PreconToolMeta, blocked: string | null): string {
  const parts = [meta.label];
  if (meta.unit) parts.push(meta.unit);
  parts.push(meta.shortcut);
  const base = parts.join(" · ");
  return blocked ? `${base} — ${blocked}` : `${base} — ${meta.hint}`;
}

function PaletteButton({ meta, active, blocked, onClick }: { meta: PreconToolMeta; active: boolean; blocked: string | null; onClick: () => void }) {
  const Icon = TOOL_ICONS[meta.key];
  return (
    <button
      type="button"
      title={toolTooltip(meta, blocked)}
      aria-label={`${meta.label} (${meta.shortcut})`}
      aria-pressed={active}
      disabled={Boolean(blocked)}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium leading-none",
        active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        blocked && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-gray-600",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="max-w-full truncate">{meta.label}</span>
      {meta.deferred ? (
        <span className="absolute right-0.5 top-0.5 rounded bg-gray-100 px-0.5 text-[8px] font-semibold text-gray-500" aria-hidden="true">
          {meta.deferred}
        </span>
      ) : null}
    </button>
  );
}
PaletteButton.displayName = "PaletteButton";

/**
 * The vertical palette on the left edge of the sheet: four groups split by
 * dividers, icon plus label at every size, the active tool in the accent
 * colour, tools that are not built yet visible but disabled.
 */
export function ToolPalette({ tool, onToolChange, blockedReasonFor, legendOpen, onToggleLegend }: Props) {
  return (
    <nav aria-label="Measuring tools" className="flex w-16 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-gray-200 bg-white px-1 py-1.5">
      {PRECON_TOOL_GROUPS.map((group, index) => (
        <div key={group} role="group" aria-label={group} className={cn("flex flex-col gap-0.5", index > 0 && "mt-1 border-t border-gray-200 pt-1")}>
          {PRECON_TOOL_META.filter((meta) => meta.group === group).map((meta) => {
            const blocked = meta.deferred ? `Arrives in ${meta.deferred}` : blockedReasonFor(meta);
            const isLegend = meta.key === "legend";
            return (
              <PaletteButton
                key={meta.key}
                meta={meta}
                active={isLegend ? legendOpen : tool === meta.key}
                blocked={blocked}
                onClick={() => (isLegend ? onToggleLegend() : onToolChange(meta.key))}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}
ToolPalette.displayName = "ToolPalette";
