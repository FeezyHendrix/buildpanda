import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";

interface RowActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  ariaLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
}

/**
 * The ⋮ edit/delete menu on a table row or card. One implementation instead of
 * a hand-rolled copy per page, built from the Button atom's ghost variant.
 */
function RowActionsMenu({
  onEdit,
  onDelete,
  ariaLabel = "Actions",
  editLabel = "Edit",
  deleteLabel = "Delete",
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="size-8 px-0 text-gray-400 hover:text-gray-600"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </Button>

      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 flex min-w-[120px] flex-col rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal text-gray-700"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            {editLabel}
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {deleteLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

RowActionsMenu.displayName = "RowActionsMenu";

export { RowActionsMenu, type RowActionsMenuProps };
