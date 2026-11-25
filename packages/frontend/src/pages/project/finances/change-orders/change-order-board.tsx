import type { ChangeRequest, ChangeStatus } from "@/lib/project-types";
import { BOARD_COLUMNS } from "./change-order-model";
import { ChangeOrderCard } from "./change-order-card";

interface ChangeOrderBoardProps {
  changes: ChangeRequest[];
  /** Show only these columns; all of them when omitted. */
  statuses?: readonly ChangeStatus[];
  projectId: string;
  canManage: boolean;
  onView: (cr: ChangeRequest) => void;
  onAssign: (cr: ChangeRequest) => void;
  onEdit: (cr: ChangeRequest) => void;
  onDelete: (cr: ChangeRequest) => void;
}

/**
 * The ladder as columns. It scrolls sideways and bleeds off the right edge of
 * the page, so a column is never squeezed to make the fifth fit.
 */
export function ChangeOrderBoard({ changes, statuses, ...handlers }: ChangeOrderBoardProps) {
  const columns = statuses ? BOARD_COLUMNS.filter((column) => statuses.includes(column.status)) : BOARD_COLUMNS;
  return (
    <div className="-mr-4 overflow-x-auto pb-4 pr-4 sm:-mr-10 sm:pr-10 lg:-mr-[40px] lg:pr-[40px] no-scrollbar">
      <div className="flex w-max items-start gap-[15px]">
        {columns.map((column) => {
          const inColumn = changes.filter((cr) => cr.status === column.status);
          return (
            <section key={column.status} aria-label={column.label} className="flex w-[316px] shrink-0 flex-col gap-[13px] bg-[#F5F5F5] px-[12px] pb-[13px] pt-[12px]">
              <header className="flex h-[24px] items-center gap-[10px]">
                <h2 className="text-[14px] font-semibold leading-[24px] text-[#1E1E1E]">{column.label}</h2>
                <span className="flex h-[24px] min-w-[24px] items-center justify-center rounded-full bg-white px-[6px] text-caption-m font-medium tabular-nums text-[#1E1E1E]">
                  {inColumn.length}
                </span>
              </header>
              {inColumn.length === 0 ? (
                <p className="bg-white px-[16px] py-[24px] text-center text-caption-m text-[#737373]">Nothing here</p>
              ) : (
                inColumn.map((cr) => <ChangeOrderCard key={cr.id} cr={cr} {...handlers} />)
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

ChangeOrderBoard.displayName = "ChangeOrderBoard";
