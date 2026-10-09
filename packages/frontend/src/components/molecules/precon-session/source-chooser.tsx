import { useEffect, useRef } from "react";
import { Badge } from "@/components/atoms/badge";
import { PRECON_TOOL_BY_KEY } from "@/lib/precon-meta";
import { cn } from "@/lib/utils";
import type { PreconGeometry } from "@/api/precon";
import type { SourceChoice } from "./use-source-navigation";

function describe(geometry: PreconGeometry): string {
  const tool = geometry.definition?.tool;
  const label = tool ? (PRECON_TOOL_BY_KEY[tool as keyof typeof PRECON_TOOL_BY_KEY]?.label ?? tool) : geometry.kind;
  const quantity =
    geometry.quantity === null ? "no recorded figure" : `${geometry.quantity} ${geometry.unit ?? ""}`.trim();
  return `${label} · ${quantity}`;
}

/**
 * Which annotation to open, when a figure has more than one behind it.
 *
 * Asked rather than guessed. A bill line summing three drawn shapes has three
 * different places a QS might need to look, and picking the first would send
 * them to the wrong drawing without ever saying there were others.
 */
export function SourceChooser({
  choice,
  sheetCodeOf,
  onPick,
  onClose,
}: {
  choice: SourceChoice;
  sheetCodeOf: (sheetId: string) => string;
  onPick: (geometry: PreconGeometry) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-label={`Measurements behind ${choice.label}`}
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface shadow-drawer outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Which measurement?</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {choice.geometries.length} measurements add up to &ldquo;{choice.label}&rdquo;. Choose the one to open.
          </p>
        </div>
        <ul>
          {choice.geometries.map((geometry) => (
            <li key={geometry.id} className="border-b border-line-hair last:border-b-0">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left outline-none",
                  "hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900/10",
                )}
                onClick={() => onPick(geometry)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-ink">{describe(geometry)}</span>
                  <span className="block text-[11px] text-black-300">{sheetCodeOf(geometry.sheetId)}</span>
                </span>
                <Badge size="sm" tone={geometry.source === "manual" ? "info" : "neutral"}>
                  {geometry.source === "manual" ? "Drawn" : "Panda AI"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
SourceChooser.displayName = "SourceChooser";
