import { Menu } from "@base-ui-components/react/menu";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import {
  ACTION_PRIORITY_META,
  ACTION_STATUS_META,
} from "@/components/molecules/action-item-detail-dialog";
import type { ActionItem, ActionStatus, RecurrenceUnit } from "@/lib/project-types";

const COLUMNS: ActionStatus[] = ["Open", "InProgress", "Blocked", "Resolved"];

const columnAccent: Record<ActionStatus, string> = {
  Open: "bg-gray-300",
  InProgress: "bg-[#004DE7]",
  Blocked: "bg-amber-500",
  Resolved: "bg-emerald-500",
};

function recurrenceShort(unit: RecurrenceUnit, interval: number | null): string {
  const count = interval ?? 1;
  const noun = unit === "day" ? "day" : unit === "week" ? "week" : "month";
  return count === 1 ? `every ${noun}` : `every ${count} ${noun}s`;
}

interface KanbanBoardProps {
  items: ActionItem[];
  canManage: boolean;
  onMove: (item: ActionItem, status: ActionStatus) => void;
  onOpen: (itemId: string) => void;
}

function MoveMenu({
  current,
  onMove,
}: {
  current: ActionStatus;
  onMove: (status: ActionStatus) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "rounded-md px-2 py-1 text-xs font-medium text-gray-500 outline-none",
          "hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
        aria-label="Move to status"
        onClick={(e) => e.stopPropagation()}
      >
        Move
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6}>
          <Menu.Popup
            className={cn(
              "z-50 min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none",
            )}
          >
            {COLUMNS.filter((s) => s !== current).map((s) => (
              <Menu.Item
                key={s}
                className={cn(
                  "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                  "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
                )}
                onClick={() => onMove(s)}
              >
                {ACTION_STATUS_META[s].label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function BoardCard({
  item,
  canManage,
  onMove,
  onOpen,
}: {
  item: ActionItem;
  canManage: boolean;
  onMove: (item: ActionItem, status: ActionStatus) => void;
  onOpen: (itemId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <button type="button" onClick={() => onOpen(item.id)} className="w-full text-left">
        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={ACTION_PRIORITY_META[item.priority].tone} size="sm">
            {item.priority}
          </Badge>
          {item.recurrenceUnit && (
            <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#004DE7]">
              Repeats {recurrenceShort(item.recurrenceUnit, item.recurrenceInterval)}
            </span>
          )}
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {item.assigneeName ? (
            <>
              <Avatar name={item.assigneeName} size="sm" />
              <span className="truncate text-xs text-gray-500">{item.assigneeName}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.dueDate && (
            <span className="text-xs text-gray-500">{formatDayMonth(item.dueDate)}</span>
          )}
          {canManage && <MoveMenu current={item.status} onMove={(s) => onMove(item, s)} />}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ items, canManage, onMove, onOpen }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      {COLUMNS.map((status) => {
        const colItems = items.filter((i) => i.status === status);
        return (
          <div key={status} className="flex flex-col gap-3 rounded-2xl bg-[#FAFAFA] p-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", columnAccent[status])} />
                <span className="text-sm font-semibold text-gray-900">
                  {ACTION_STATUS_META[status].label}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-400">{colItems.length}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {colItems.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-gray-400">Nothing here</p>
              ) : (
                colItems.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onMove={onMove}
                    onOpen={onOpen}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

KanbanBoard.displayName = "KanbanBoard";

export { KanbanBoard, type KanbanBoardProps };
