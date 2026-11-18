import Ionicons from "@/components/atoms/icon";
import { useState } from "react";
import { Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { useStageScope } from "@/lib/stage-scope";
import { WorkspaceSheet } from "./workspace-sheet";
export function StageSelector() {
    const scope = useStageScope();
    const [open, setOpen] = useState(false);
    if (!scope.canView)
        return null;
    const label = scope.stage?.name ?? (scope.stageId ? "Selected build stage" : "All build stages");
    return (<div className="field-stack border-b border-line bg-surface px-4 py-2">
      <div className="field-stack flex-row items-center gap-2">
        <button role="button" aria-label={`Build stage: ${label}`} aria-expanded={open} onClick={() => setOpen(true)} className="min-h-11 flex-1 flex-row items-center gap-2 rounded-lg border border-line px-3 active:bg-surface-alt" type="button">
          <Ionicons name="layers-outline" size={18} color={scope.stageId ? ICON_BRAND : ICON_MUTED}/>
          <Text className="min-w-0 flex-1 text-sm" weight="medium" numberOfLines={1}>{label}</Text>
          <Ionicons name="chevron-down" size={16} color={ICON_MUTED}/>
        </button>
        {scope.stageId ? (<button role="button" aria-label="Clear build stage filter" onClick={() => scope.selectStage(undefined)} className="h-11 w-11 items-center justify-center rounded-lg bg-primary-50" type="button">
            <Ionicons name="close" size={20} color={ICON_BRAND}/>
          </button>) : null}
      </div>
      {scope.error && scope.stages.length === 0 ? (<button role="button" onClick={scope.refetch} className="min-h-11 justify-center" type="button">
          <Text tone="secondary" className="text-xs">Build stages unavailable. Tap to retry.</Text>
        </button>) : null}
      <WorkspaceSheet title="Filter by build stage" visible={open} loading={scope.isLoading} workspaces={[{ id: "", name: "All build stages" }, ...scope.stages]} activeId={scope.stageId ?? ""} onSelect={(id) => { scope.selectStage(id || undefined); setOpen(false); }} onClose={() => setOpen(false)}/>
    </div>);
}
