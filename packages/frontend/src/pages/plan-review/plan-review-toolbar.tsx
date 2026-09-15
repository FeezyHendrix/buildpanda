import { Columns2, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { MARKUP_COLORS, TOOLS, type Tool } from "./plan-review-types";

interface MarkupToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  markupColor: string;
  onSelectColor: (color: string) => void;
  markupVisible: boolean;
  onToggleMarkup: () => void;
  canCompare: boolean;
  comparing: boolean;
  onCompare: () => void;
}

/** One tool strip works across the review canvas and both comparison panes. */
export function MarkupToolbar({
  activeTool,
  onSelectTool,
  markupColor,
  onSelectColor,
  markupVisible,
  onToggleMarkup,
  canCompare,
  comparing,
  onCompare,
}: MarkupToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Plan tools"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line-hair bg-white px-3 py-2"
    >
      <>
        {TOOLS.map(({ id, label, shortcut, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={activeTool === id}
            title={`${label} (${shortcut})`}
            onClick={() => onSelectTool(id)}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium",
              activeTool === id ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-surface-alt",
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: markupColor }}
          />
          <span className="sr-only">Ink color</span>
          <select
            aria-label="Ink color"
            value={markupColor}
            onChange={(event) => onSelectColor(event.target.value)}
            className={cn(INPUT_SM_CLASS, "w-auto")}
          >
            {MARKUP_COLORS.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={markupVisible ? "Hide annotations" : "Show annotations"}
          title={markupVisible ? "Hide annotations" : "Show annotations"}
          aria-pressed={!markupVisible}
          onClick={onToggleMarkup}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-surface-alt"
        >
          {markupVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </>
      {canCompare ? (
        <Button variant="secondary" size="sm" className="ml-auto" onClick={onCompare}>
          {comparing ? <X size={14} /> : <Columns2 size={14} />}
          {comparing ? "Back to review" : "Compare plans"}
        </Button>
      ) : null}
    </div>
  );
}
MarkupToolbar.displayName = "MarkupToolbar";
