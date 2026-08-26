import { Select } from "@/components/atoms/select";
import type { Building } from "@/api/buildings";
import { useBuildingScope } from "@/contexts/building-scope-context";

interface BuildingSwitcherProps {
  buildings: Building[];
  onClose?: () => void;
}

const ALL_VALUE = "__all__";

export function BuildingSwitcher({ buildings, onClose }: BuildingSwitcherProps) {
  const { selectedBuildingId, setSelectedBuildingId } = useBuildingScope();

  if (buildings.length === 0) return null;

  const options = [
    { value: ALL_VALUE, label: "All buildings" },
    ...buildings.map((b) => ({ value: b.id, label: b.name })),
  ];

  const value = selectedBuildingId ?? ALL_VALUE;

  return (
    <Select
      options={options}
      value={value}
      onChange={(next) => {
        const id = next === ALL_VALUE ? undefined : (next ?? undefined);
        setSelectedBuildingId(id);
        onClose?.();
      }}
      placeholder="All buildings"
    />
  );
}
