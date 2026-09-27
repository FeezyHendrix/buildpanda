import { Eye, EyeOff, MessageSquare, Pencil, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

// One sheet carries two kinds of work: measurements that became bill lines,
// and markup that says something about the drawing. Someone reading a plan
// wants the markup without the take-off underneath it, and an estimator wants
// the reverse, so each layer turns off on its own.

export const SHEET_LAYERS = ["measurements", "ink", "comments"] as const;
export type SheetLayer = (typeof SHEET_LAYERS)[number];

export type LayerVisibility = Record<SheetLayer, boolean>;

export const ALL_LAYERS_VISIBLE: LayerVisibility = { measurements: true, ink: true, comments: true };

const LAYER_META: { key: SheetLayer; label: string; Icon: typeof Ruler }[] = [
  { key: "measurements", label: "Measurements", Icon: Ruler },
  { key: "ink", label: "Pen", Icon: Pencil },
  { key: "comments", label: "Comments", Icon: MessageSquare },
];

/** Show or hide each layer on the sheet. Counts say what is being hidden. */
export function LayerToggles({
  layers,
  counts,
  onToggle,
}: {
  layers: LayerVisibility;
  counts: Record<SheetLayer, number>;
  onToggle: (layer: SheetLayer) => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-0.5 rounded-lg border border-line bg-white/95 p-1 shadow-sm">
      {LAYER_META.map(({ key, label, Icon }) => {
        const on = layers[key];
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={on}
            title={`${on ? "Hide" : "Show"} ${label.toLowerCase()}${count ? ` (${count})` : ""}`}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              on ? "text-gray-700 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-50",
            )}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="min-w-14 text-left">{label}</span>
            <span className="tabular-nums text-gray-400">{count || ""}</span>
            {on ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

LayerToggles.displayName = "LayerToggles";
