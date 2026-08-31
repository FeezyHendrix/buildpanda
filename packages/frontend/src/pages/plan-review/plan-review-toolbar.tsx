import { Check, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKUP_COLORS, TOOL, TOOLS, type Tool } from "./plan-review-types";
import { Kbd, PopShell } from "./plan-review-ui";

export function MarkupToolbar({
  activeTool,
  onSelectTool,
  markupColor,
  onSelectColor,
  colorOpen,
  onToggleColor,
  measuring,
  canCompare,
  onCompare,
}: {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  markupColor: string;
  onSelectColor: (color: string) => void;
  colorOpen: boolean;
  onToggleColor: () => void;
  measuring: boolean;
  canCompare: boolean;
  onCompare: () => void;
}) {
  return (
      <div className="relative z-30 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#F0F0F0] bg-white px-3 py-1.5">
        {TOOLS.map(({ id, label, shortcut, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={activeTool === id}
            title={`${label} (${shortcut})`}
            onClick={() => onSelectTool(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTool === id
                ? "bg-primary-600 text-white ring-1 ring-primary-200"
                : "text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900",
            )}
          >
            <Icon size={15} />
            <span className="hidden lg:inline">{label}</span>
            <Kbd className="hidden md:inline-block">{shortcut}</Kbd>
          </button>
        ))}

        <div className="relative ml-1">
          <button
            type="button"
            data-popover-trigger
            aria-label="Markup color"
            aria-haspopup="true"
            aria-expanded={colorOpen}
            title="Markup color"
            onClick={onToggleColor}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[#F6F6F6]"
          >
            <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: markupColor }} />
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          {colorOpen && (
            <PopShell className="left-0 flex w-max gap-1.5 p-2">
              {MARKUP_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-label={`${color.label} markup color`}
                  title={color.label}
                  onClick={() => onSelectColor(color.value)}
                  className="flex size-7 items-center justify-center rounded-full border border-black/10"
                  style={{ backgroundColor: color.value }}
                >
                  {markupColor === color.value ? <Check size={13} className="text-white drop-shadow" /> : null}
                </button>
              ))}
            </PopShell>
          )}
        </div>

        {activeTool === TOOL.MEASURE && (
          <span className="ml-2 hidden shrink-0 text-[11px] text-gray-500 md:inline">
            {measuring ? "Click the second point to finish" : "Click two points to measure"}
          </span>
        )}

        {canCompare && (
          <button
            type="button"
            title="Compare revisions"
            onClick={onCompare}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-[#EDEDED] px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
          >
            <Layers size={14} /> Compare
          </button>
        )}
      </div>
  );
}

MarkupToolbar.displayName = "MarkupToolbar";
