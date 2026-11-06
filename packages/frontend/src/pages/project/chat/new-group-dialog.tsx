import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { TextInput } from "@/components/atoms/text-input";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";
import { ModalShell } from "@/components/molecules/modal-shell";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, isPrivate: boolean) => void;
  loading?: boolean;
}

export function NewGroupDialog({ open, onClose, onSubmit, loading = false }: Props) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const canCreate = Boolean(name.trim()) && !loading;

  function handleSubmit(event: { preventDefault(): void }): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed, isPrivate);
    setName("");
    setIsPrivate(false);
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="New Group"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor="group-name" className="text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">
          Group Name
        </label>
        <TextInput
          id="group-name"
          autoFocus
          value={name}
          onChange={setName}
          placeholder="e.g. MEP coordination"
          className="mt-[4px] h-[45px] border border-[#EEEEEE] px-4 text-[14px] placeholder:text-[#A5A5A5]"
        />

        <div className="mt-[24px] flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold leading-[20px] text-[#1E1E1E]">Operator Required</p>
            <p className="mt-[4px] text-[12px] leading-[16px] text-[#737373]">
              Only invited members can see and post in a private group.
            </p>
          </div>
          <ToggleSwitch size="sm" checked={isPrivate} onChange={setIsPrivate} ariaLabel="Operator Required" />
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={!canCreate}
          loading={loading}
          className="mt-[40px] h-[46px] w-full text-[14px] disabled:bg-[#F5F5F5] disabled:text-[#1E1E1E] disabled:opacity-100"
        >
          Create Group
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={loading}
          className="h-[46px] w-full text-[14px] text-[#1E1E1E]"
        >
          Cancel
        </Button>
      </form>
    </ModalShell>
  );
}

NewGroupDialog.displayName = "NewGroupDialog";
