import { features } from "@/lib/feature-access";
import { useProjectAccess } from "@/lib/project-access-provider";
import Ionicons from "@/components/atoms/icon";
import { useState } from "react";
import { Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { WorkspaceSheet } from "./workspace-sheet";
export function BuildingSelector() {
    const scope = useProjectBuilding();
    const { allows } = useProjectAccess();
    const [open, setOpen] = useState(false);
    if (!allows(features.buildings.read))
        return null;
    const label = scope.building?.name ?? (scope.buildingId ? "Selected building" : "Choose a building");
    // Every project is created with exactly one real building, so this bar had
    // nothing to offer and just read "Choose a building" at a crew with nothing
    // to choose. Keep it for a real choice, or to offer the reload.
    const hasChoice = scope.buildings.length > 1;
    const needsReload = !scope.isLoading && scope.buildings.length === 0;
    if (!hasChoice && !needsReload)
        return null;
    return (<div className="field-stack border-b border-hairline bg-surface px-4 py-2">
      <button onClick={() => setOpen(true)} role="button" aria-label={`Building: ${label}. Tap to switch building.`} className="min-h-11 flex-row items-center gap-3 rounded-lg bg-surface-alt px-3" type="button">
        <Ionicons name="business-outline" size={18} color={ICON_BRAND}/>
        <div className="field-stack min-w-0 flex-1">
          <Text tone="secondary" className="text-xs">Building</Text>
          <Text weight="semibold" tone="default" className="text-sm" numberOfLines={1}>{label}</Text>
        </div>
        {scope.building?.code ? <Text tone="secondary" className="text-xs">{scope.building.code}</Text> : null}
        <Ionicons name="chevron-down" size={16} color={ICON_BRAND}/>
      </button>
      <WorkspaceSheet title="Choose a building" visible={open} loading={scope.isLoading} workspaces={scope.buildings.map((b) => ({ id: b.id, name: b.code ? `${b.name} (${b.code})` : b.name }))} activeId={scope.buildingId} onSelect={(id) => { scope.selectBuilding(id); setOpen(false); }} onClose={() => setOpen(false)}/>
      {!scope.isLoading && scope.buildings.length === 0 ? (<div className="field-stack pt-2">
          <Text tone="secondary" className="text-xs">
            {scope.error ? "Buildings are not available on this device yet. Reconnect to load them." : "No buildings have been added to this project yet."}
          </Text>
          <button role="button" onClick={() => void scope.refetch()} className="min-h-11 justify-center" type="button">
            <Text tone="default" weight="semibold">Reload buildings</Text>
          </button>
        </div>) : null}
    </div>);
}
