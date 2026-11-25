import type { ReactNode } from "react";
import { AddImageButton, FileLink } from "@/components/molecules/image-attach";
import { SHEET_HEADER_PLAIN, SHEET_HEADER_RULED, SheetRule, WIDE_SHEET } from "@/components/molecules/wide-sheet";
import { cn } from "@/lib/utils";

/**
 * Pieces the four purchase-order drawers share: the 1026px sheet's form chrome,
 * the "Line Items" heading and grey column band, and the image attachments.
 */

/** FormDrawer styling for the wide PO sheets (new, edit, receive). */
export const PO_SHEET = { ...WIDE_SHEET, className: "w-[min(1026px,100vw)]" } as const;

export const PO_HEADER_RULED = SHEET_HEADER_RULED;
export const PO_HEADER_PLAIN = SHEET_HEADER_PLAIN;

export { SheetRule };

/** "Line Items" with its one-line explanation, and an optional action at the right. */
export function LinesHeading({ hint, action }: { hint: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-[16px]">
      <div>
        <h3 className="text-[16px] font-medium leading-[24px] text-[#1E1E1E]">Line Items</h3>
        <p className="mt-[3px] text-caption-l text-[#737373]">{hint}</p>
      </div>
      {action}
    </div>
  );
}

/** The grey column band over the lines: `columns` is the grid template that keeps the cells aligned with the rows. */
export function LinesBand({ columns, labels, className }: { columns: string; labels: readonly string[]; className?: string }) {
  return (
    <div
      className={cn("grid h-[52px] items-center border border-[#EEEEEE] bg-[#F6F6F6] pl-[24px] text-caption-l font-medium text-[#525252]", className)}
      style={{ gridTemplateColumns: columns }}
    >
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

export { AddImageButton, FileLink };
