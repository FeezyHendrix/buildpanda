import { useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Label } from "@/components/atoms/label";
import { useCreateEstimate } from "@/hooks/use-proposals";
import { cn } from "@/lib/utils";

interface Props {
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EstimateRevisionDrawer({ proposalId, open, onOpenChange }: Props) {
  const [changeNote, setChangeNote] = useState("");
  const createEstimate = useCreateEstimate(proposalId);

  async function handleCreateRevision() {
    if (!changeNote.trim()) return;
    await createEstimate.mutateAsync({ changeNote: changeNote.trim() || undefined });
    onOpenChange(false);
    setChangeNote("");
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New estimate revision"
      description="This will supersede the previous sent estimate. A change note is required."
      submitLabel="Create revision"
      submitDisabled={!changeNote.trim()}
      submitting={createEstimate.isPending}
      error={createEstimate.isError ? "Failed to create revision." : null}
      onSubmit={handleCreateRevision}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="change-note">Change note *</Label>
        <textarea
          id="change-note"
          rows={4}
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Describe what changed in this revision…"
          className={cn(
            "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
            "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            "resize-none placeholder:text-gray-400",
          )}
        />
      </div>
    </FormDrawer>
  );
}
