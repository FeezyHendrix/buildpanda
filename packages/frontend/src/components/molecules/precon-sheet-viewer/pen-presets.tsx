import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";

export interface PenStyle {
  color: string;
  strokeWidthPx: number;
}

export const PEN_COLORS = ["#DC2626", "#2563EB", "#059669"] as const;
export const PEN_WIDTHS = [2, 4, 6] as const;
export const DEFAULT_PEN_STYLE: PenStyle = { color: PEN_COLORS[0], strokeWidthPx: PEN_WIDTHS[0] };

interface Props {
  style: PenStyle;
  onChange: (style: PenStyle) => void;
}

/** Colour and stroke-width presets while the Pen is active. Ink is a note, never a quantity. */
export function PenPresets({ style, onChange }: Props) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-none border border-line bg-white p-1.5 shadow-sm" data-pen-presets onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <span className="text-caption-m text-ink-muted">Pen stays active — Esc to stop</span>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      {PEN_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Ink colour ${color}`}
          aria-pressed={style.color === color}
          className={cn("size-6 rounded-full border-2", style.color === color ? "border-black-500" : "border-transparent")}
          style={{ backgroundColor: color }}
          onClick={() => onChange({ ...style, color })}
        />
      ))}
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      {PEN_WIDTHS.map((width) => (
        <Button
          key={width}
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Stroke width ${width} pixels`}
          aria-pressed={style.strokeWidthPx === width}
          className={cn("h-6 w-8 px-0", style.strokeWidthPx === width && "bg-primary-50 hover:bg-primary-50")}
          onClick={() => onChange({ ...style, strokeWidthPx: width })}
        >
          <span className="w-5 rounded-full bg-gray-800" style={{ height: width }} />
        </Button>
      ))}
    </div>
  );
}
PenPresets.displayName = "PenPresets";
