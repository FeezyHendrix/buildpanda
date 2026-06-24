import { useState } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, isPrivate: boolean) => void;
  loading?: boolean;
}

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function NewGroupDialog({ open, onClose, onSubmit, loading = false }: Props) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  function handleSubmit(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, isPrivate);
    setName("");
    setIsPrivate(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl outline-none",
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900">
            New group
          </Dialog.Title>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. MEP coordination"
              autoFocus
              className={FIELD}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-4 rounded border-gray-300 text-[#004DE7] focus:ring-[#004DE7]"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Make private</p>
              <p className="text-xs text-gray-500">
                Only invited members can see and post in a private group.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!name.trim() || loading}
              loading={loading}
            >
              Create group
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

NewGroupDialog.displayName = "NewGroupDialog";
