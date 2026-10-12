import { FileSpreadsheet, Mail, MessageCircle, NotebookPen, ReceiptText, Unplug, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { fragmentation, type ToolId } from "@/content/fragmentation";

const icons: Record<ToolId, LucideIcon> = {
  chat: MessageCircle,
  spreadsheet: FileSpreadsheet,
  paper: NotebookPen,
  email: Mail,
  payments: ReceiptText,
  tools: Unplug,
};

// Each chip rests a few pixels off the column's centre line, so the stack never quite lines up.
const REST_OFFSETS_PX = [5, 0, 5, 5, 8, 1];

/** A connector that connects to nothing. */
function LooseEnd() {
  return (
    <svg viewBox="0 0 22 8" fill="none" stroke="currentColor" aria-hidden="true" className="h-2 w-[1.375rem] opacity-35">
      <path d="M0 4h14" />
      <circle cx="17.5" cy="4" r="2.5" />
    </svg>
  );
}

function ChipList({ decorative }: { decorative?: boolean }) {
  const { tools, listLabel } = fragmentation.broken;

  return (
    <ul
      aria-label={decorative ? undefined : listLabel}
      aria-hidden={decorative}
      className={decorative ? "chip-list chip-list-repeat" : "chip-list"}
    >
      {tools.map((tool, index) => {
        const Icon = icons[tool.id];
        const offset = REST_OFFSETS_PX[index % REST_OFFSETS_PX.length];

        return (
          <li
            key={tool.id}
            style={{ transform: `translateX(${offset}px)` } as CSSProperties}
            className="flex h-[2.625rem] items-center gap-2.5 border border-line bg-white py-1.5 pr-3 pl-1.5"
          >
            <span className="flex size-[1.875rem] items-center justify-center bg-card">
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </span>
            <span className="text-sm font-medium whitespace-nowrap">{tool.label}</span>
            <LooseEnd />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The narrow panel: the scattered places project information lives today,
 * drifting upward in an endless loop. The list is rendered twice so the loop
 * has no seam; the second copy is hidden from assistive technology.
 */
export function ToolChips() {
  return (
    <div className="chip-viewport">
      <div className="chip-track">
        <ChipList />
        <ChipList decorative />
      </div>
    </div>
  );
}
