import { type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

export interface KanbanColumn<S extends string> {
  status: S;
  label: string;
  accent: string;
}

export interface KanbanAssigneeOption {
  id: string;
  name: string;
}

export interface KanbanBoardProps<T, S extends string> {
  items: T[];
  columns: KanbanColumn<S>[];
  canManage: boolean;
  getId: (item: T) => string;
  getStatus: (item: T) => S;
  getTitle: (item: T) => string;
  renderMeta?: (item: T) => ReactNode;
  renderFooter?: (item: T) => ReactNode;
  onMove: (item: T, status: S) => void;
  onOpen: (id: string) => void;
  assigneeOptions?: KanbanAssigneeOption[];
  getAssigneeId?: (item: T) => string | null;
  onAssign?: (item: T, assigneeId: string | null) => void;
}

function AssignMenu({
  currentId: _currentId,
  options,
  onAssign,
}: {
  currentId: string | null;
  options: KanbanAssigneeOption[];
  onAssign: (assigneeId: string | null) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "rounded-md px-2 py-1 text-xs font-medium text-gray-500 outline-none",
          "hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
        aria-label="Assign"
        onClick={(e) => e.stopPropagation()}
      >
        Assign
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6}>
          <Menu.Popup
            className={cn(
              "z-50 min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none",
            )}
          >
            <Menu.Item
              className={cn(
                "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
              )}
              onClick={() => onAssign(null)}
            >
              Unassigned
            </Menu.Item>
            {options.map((option) => (
              <Menu.Item
                key={option.id}
                className={cn(
                  "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                  "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
                )}
                onClick={() => onAssign(option.id)}
              >
                {option.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MoveMenu<S extends string>({
  current,
  columns,
  onMove,
}: {
  current: S;
  columns: KanbanColumn<S>[];
  onMove: (status: S) => void;
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
            {columns
              .filter((c) => c.status !== current)
              .map((c) => (
                <Menu.Item
                  key={c.status}
                  className={cn(
                    "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                    "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
                  )}
                  onClick={() => onMove(c.status)}
                >
                  {c.label}
                </Menu.Item>
              ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function KanbanBoard<T, S extends string>({
  items,
  columns,
  canManage,
  getId,
  getStatus,
  getTitle,
  renderMeta,
  renderFooter,
  onMove,
  onOpen,
  assigneeOptions,
  getAssigneeId,
  onAssign,
}: KanbanBoardProps<T, S>) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))` }}
    >
      {columns.map((column) => {
        const colItems = items.filter((i) => getStatus(i) === column.status);
        return (
          <div key={column.status} className="flex flex-col gap-3 rounded-2xl bg-[#FAFAFA] p-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", column.accent)} />
                <span className="text-sm font-semibold text-gray-900">{column.label}</span>
              </div>
              <span className="text-xs font-medium text-gray-400">{colItems.length}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {colItems.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-gray-400">Nothing here</p>
              ) : (
                colItems.map((item) => {
                  const id = getId(item);
                  return (
                    <div
                      key={id}
                      className="rounded-xl border border-[#EDEDED] bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(id)}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-semibold text-gray-900">{getTitle(item)}</p>
                        {renderMeta && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {renderMeta(item)}
                          </div>
                        )}
                      </button>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          {renderFooter ? renderFooter(item) : <span />}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            {onAssign && getAssigneeId && (
                              <AssignMenu
                                currentId={getAssigneeId(item)}
                                options={assigneeOptions ?? []}
                                onAssign={(aid) => onAssign(item, aid)}
                              />
                            )}
                            <MoveMenu
                              current={column.status}
                              columns={columns}
                              onMove={(s) => onMove(item, s)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

KanbanBoard.displayName = "KanbanBoard";

export { KanbanBoard };
