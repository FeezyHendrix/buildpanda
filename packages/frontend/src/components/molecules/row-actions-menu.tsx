import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const NOOP = () => {};

interface RowActionItem {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
}

interface RowActionsMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
  ariaLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  /** Custom entries; when given they replace the default edit/delete pair. */
  items?: RowActionItem[];
}

const ITEM_TONE: Record<NonNullable<RowActionItem["tone"]>, string> = {
  default: "text-gray-700 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900",
  danger: "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700",
};

/**
 * The ⋮ edit/delete menu on a table row or card. The popup renders in a
 * portal so a table's scroll wrapper (`overflow-x-auto`) can never clip it.
 */
function RowActionsMenu({
  onEdit,
  onDelete,
  ariaLabel = "Actions",
  editLabel = "Edit",
  deleteLabel = "Delete",
  items,
}: RowActionsMenuProps) {
  const entries: RowActionItem[] = items ?? [
    { label: editLabel, onSelect: onEdit ?? NOOP },
    { label: deleteLabel, onSelect: onDelete ?? NOOP, tone: "danger" },
  ];

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={ariaLabel}
        // Base UI opens on mousedown and then treats the click as a toggle, which
        // closes the menu again inside a clickable row; opening on click only is reliable.
        onMouseDown={(event) => event.preventBaseUIHandler()}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400",
          "outline-none transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "data-[popup-open]:bg-gray-100 data-[popup-open]:text-gray-600",
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-[70]">
          <Menu.Popup className="flex min-w-[140px] flex-col rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none">
            {entries.map((entry) => (
              <Menu.Item
                key={entry.label}
                onClick={(event) => {
                  event.stopPropagation();
                  entry.onSelect();
                }}
                className={cn(
                  "flex h-8 cursor-default select-none items-center rounded-md px-3 text-sm whitespace-nowrap outline-none",
                  ITEM_TONE[entry.tone ?? "default"],
                )}
              >
                {entry.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

RowActionsMenu.displayName = "RowActionsMenu";

export { RowActionsMenu, type RowActionsMenuProps, type RowActionItem };
