import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { Building } from "@/api/buildings";

interface CloneProgrammeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetBuilding: Building | null;
  buildings: Building[];
  onSubmit: (fromBuildingId: string) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function CloneProgrammeDialog({
  open,
  onOpenChange,
  targetBuilding,
  buildings,
  onSubmit,
  isSubmitting = false,
  error,
}: CloneProgrammeDialogProps) {
  const [fromBuildingId, setFromBuildingId] = useState<string>("");

  const availableBuildings = buildings.filter((b) => b.id !== targetBuilding?.id && b.kind === "real");

  useEffect(() => {
    if (open && availableBuildings.length > 0) {
      setFromBuildingId(availableBuildings[0]?.id || "");
    }
  }, [open, availableBuildings]);

  function handleSubmit(): void {
    if (!fromBuildingId) return;
    onSubmit(fromBuildingId);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Clone Programme"
      description={`Copy stages from another building into ${targetBuilding?.name || "this building"}.`}
      submitLabel="Clone Programme"
      submitDisabled={!fromBuildingId || availableBuildings.length === 0}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from-building">Source building</Label>
        <select
          id="from-building"
          value={fromBuildingId}
          onChange={(e) => setFromBuildingId(e.target.value)}
          className={field}
          disabled={availableBuildings.length === 0}
        >
          {availableBuildings.length === 0 && <option value="">No other buildings available</option>}
          {availableBuildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}
