import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switcher, type SwitcherValue } from "@/components/atoms";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, isPrivate: boolean) => void;
  loading?: boolean;
}

export function NewGroupDialog({ open, onClose, onSubmit, loading = false }: Props) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState<SwitcherValue>("no");

  function handleSubmit(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, isPrivate === "yes");
    setName("");
    setIsPrivate("no");
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
            "flex flex-col gap-5 rounded-lg border border-line-hair bg-white p-6 shadow-lg outline-none",
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-ink">
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
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Make private</p>
              <p className="text-xs text-ink-muted">
                Only invited members can see and post in a private group.
              </p>
            </div>
            <Switcher value={isPrivate} onChange={setIsPrivate} />
          </div>

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
