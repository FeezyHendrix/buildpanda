/** Null explicitly requests the whole project; undefined has no chosen building. */
export function filterBuildingRows<T extends { buildingId?: string | null }>(
  rows: readonly T[],
  buildingId: string | null | undefined,
  singleBuilding = false,
): T[] {
  if (buildingId === null) return [...rows];
  if (!buildingId) return [];
  return rows.filter((row) => row.buildingId === buildingId || (singleBuilding && !row.buildingId));
}
