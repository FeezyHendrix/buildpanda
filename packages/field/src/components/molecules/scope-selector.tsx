import Ionicons from "@/components/atoms/icon";
import { memo } from "react";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
interface ScopeSelectorProps {
    workspaceName?: string;
    projectName?: string;
    projectPending?: boolean;
    onPressProject?: () => void;
    compact?: boolean;
}
/** The project switcher uses the same neutral surface as the v2 workspace. */
export const ScopeSelector = memo(function ScopeSelector({ projectName, projectPending = false, onPressProject, compact = false, }: ScopeSelectorProps) {
    return (<div className="field-stack min-w-0 flex-row items-stretch gap-2">
      <button onClick={onPressProject} disabled={!onPressProject} role={onPressProject ? "button" : undefined} aria-label={projectName ? `Project: ${projectName}. Tap to switch project.` : undefined} className={compact
            ? "min-h-11 shrink flex-row items-center gap-2 rounded-lg bg-surface-alt px-3 active:bg-grey-100"
            : "min-h-11 flex-1 flex-row items-center gap-2 rounded-lg bg-surface-alt px-3 active:bg-grey-100"} type="button">
        <Ionicons name="business-outline" size={16} color={ICON_BRAND}/>
        <div className={"field-stack " + (compact ? "min-w-0 shrink" : "min-w-0 flex-1")}>
          {!compact ? <Text tone="secondary" className="text-xs">Current project</Text> : null}
          {projectPending && !projectName ? (<div className="field-stack items-start py-0.5">
              <Spinner size="xs" tone="brand"/>
            </div>) : (<Text weight="semibold" tone="default" className={compact ? "text-xs" : "text-sm"} numberOfLines={1}>
              {projectName ?? "Choose a project"}
            </Text>)}
        </div>
        {onPressProject ? (<div className="field-stack flex-row items-center gap-0.5">
            {!compact ? <Text weight="semibold" tone="brand" className="text-xs">Switch</Text> : null}
            <Ionicons name="chevron-down" size={16} color={ICON_BRAND}/>
          </div>) : null}
      </button>

    </div>);
});
export type { ScopeSelectorProps };
