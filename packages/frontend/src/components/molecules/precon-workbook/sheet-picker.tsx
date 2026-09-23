import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import type { WorkbookLayout } from "@/api/workbook-types";

interface Props {
  layout: WorkbookLayout;
  activeSheetId: string | null;
  onSelect: (sheetId: string) => void;
  onDelete: (sheetId: string) => void;
  onClose: () => void;
}

/**
 * Every worksheet in one reachable list.
 *
 * The engine's own tab strip is the primary way through the workbook, but it
 * runs out of room long before the worksheets do — and at 375px it runs out
 * immediately. This is the guarantee that a bill is always reachable, mirroring
 * the viewer's `tool-picker.tsx`: a dialog, Escape closes it, focus returns to
 * the trigger.
 *
 * It shows `label` — the bill's title as it reads now — and never `name`, which
 * is the pinned string cross-sheet formulas spell.
 */
export function SheetPicker({ layout, activeSheetId, onSelect, onDelete, onClose }: Props) {
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
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/20 p-3" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-label="All worksheets"
        tabIndex={-1}
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-lg border border-line bg-surface shadow-drawer outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="border-b border-line px-3 py-2 text-[11px] font-semibold text-black-300">All worksheets</p>
        <a
          href="/third-party-notices.txt"
          target="_blank"
          rel="noreferrer"
          className="block border-b border-line-hair px-3 py-1.5 text-[11px] text-ink-muted outline-none hover:text-primary-600 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          Third-party licences
        </a>
        <ul>
          {layout.sheets.map((sheet) => (
            <li key={sheet.sheetId} className="flex items-center gap-2 border-b border-line-hair last:border-b-0">
              <button
                type="button"
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px] outline-none",
                  sheet.sheetId === activeSheetId ? "bg-primary-50 font-semibold text-primary-700" : "text-ink",
                  "hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900/10",
                )}
                onClick={() => {
                  onSelect(sheet.sheetId);
                  onClose();
                }}
              >
                <span className="truncate">{sheet.label}</span>
                {sheet.kind !== "scratch" ? (
                  <Badge size="sm" tone="info">
                    {sheet.kind === "summary" ? "Summary" : "Bill"}
                  </Badge>
                ) : null}
              </button>
              {sheet.kind === "scratch" ? (
                <Button
                  size="sm"
                  variant="danger"
                  className="mr-1 h-7 w-7 shrink-0 px-0"
                  title={`Delete ${sheet.label}`}
                  aria-label={`Delete ${sheet.label}`}
                  onClick={() => onDelete(sheet.sheetId)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
SheetPicker.displayName = "SheetPicker";
