import { Text } from "@/components/atoms";
import { useProjectBuilding } from "@/hooks/use-project-building";

/** Detail pages name the record's building, independent of the current list filter. */
export function BuildingLabel({ buildingId }: { buildingId: string | null | undefined }) {
  const { buildings } = useProjectBuilding();
  const building = buildings.find((row) => row.id === buildingId);
  if (!building) return null;
  return <Text tone="brand" weight="semibold" className="text-sm">Building · {building.name}</Text>;
}
