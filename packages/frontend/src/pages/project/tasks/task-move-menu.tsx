import { Menu } from "@base-ui/react/menu";
import type { TaskColumn } from "@/lib/project-types";

const MENU_ITEM =
  "flex w-full cursor-default select-none items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 outline-none data-[highlighted]:bg-surface-alt data-[highlighted]:text-gray-900";

interface TaskMoveMenuProps {
  taskTitle: string;
  columns: readonly TaskColumn[];
  currentColumnId: string;
  onMove: (columnId: string) => void;
}

/**
 * Moving a card was drag-and-drop only, and the dnd-kit keyboard sensor did not
 * respond (finding #31) — so a keyboard or touch user could not move a task at
 * all. This menu is the accessible path; dragging still works for a mouse.
 */
function TaskMoveMenu({ taskTitle, columns, currentColumnId, onMove }: TaskMoveMenuProps) {
  const targets = columns.filter((column) => column.id !== currentColumnId);
  if (targets.length === 0) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Move "${taskTitle}" to another column`}
        // The card is a drag source; a pointerdown here must not start a drag.
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.preventBaseUIHandler()}
        className="inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium text-gray-400 outline-none transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:shadow-focus"
      >
        Move ▸
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60]">
          <Menu.Popup className="min-w-[180px] rounded-lg border border-line bg-white p-1.5 shadow-card outline-none">
            {targets.map((column) => (
              <Menu.Item key={column.id} className={MENU_ITEM} onClick={() => onMove(column.id)}>
                {column.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

TaskMoveMenu.displayName = "TaskMoveMenu";

export { TaskMoveMenu, type TaskMoveMenuProps };
