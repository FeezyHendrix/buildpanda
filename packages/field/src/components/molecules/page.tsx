import { useRef, type ReactNode } from 'react';
import { router } from '@/navigation';
import { Text, SyncIndicator } from '@/components/atoms';
import { useSyncState } from '@/lib/sync-provider';
import { cn } from '@/lib/utils';
import { BuildingSelector } from './building-selector';
import { StageSelector } from './stage-selector';
import { ScopeSelector } from './scope-selector';
import { HeaderIconButton } from './header-icon-button';
import { useProjectBuilding } from '@/hooks/use-project-building';
import { KeyboardRevealContext } from '@/hooks/use-keyboard-avoidance';
interface PageProps {
    /** Retained for callers; v2 headers use a leading title. */
    variant?: "default" | "left";
    title?: string;
    description?: string;
    onBack?: () => void;
    rightButtons?: ReactNode;
    showSync?: boolean;
    onPressSync?: () => void;
    workspaceName?: string;
    projectName?: string;
    /** Keeps the scope slot in place with a spinner while the project name loads. */
    projectPending?: boolean;
    onPressProject?: () => void;
    /** Set false when the child owns scrolling (FlatList screens). */
    scroll?: boolean;
    footer?: ReactNode;
    className?: string;
    buildingScope?: boolean;
    /** With `buildingScope`: show the picker but render the page without a building too. */
    buildingOptional?: boolean;
    stageScope?: boolean;
    children: ReactNode;
}
function PageContent({ title, description, onBack, rightButtons, showSync = true, onPressSync, workspaceName, projectName, projectPending = false, onPressProject, scroll = true, footer, className, children, buildingScope = false, stageScope = false }: PageProps) {
    const sync = useSyncState();
    const scroller = useRef<HTMLDivElement>(null);
    const hasScope = Boolean(projectName || workspaceName || projectPending || onPressProject);
    return <KeyboardRevealContext.Provider value={() => { setTimeout(() => document.activeElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100); }}><div className="field-stack flex min-h-0 flex-1 flex-col bg-canvas"><header className="shrink-0 border-b border-line bg-surface px-4 pb-3 pt-2"><div className="field-stack flex min-h-11 flex-row items-center gap-2">{onBack ? <button type="button" aria-label="Go back" onClick={onBack} className="h-11 w-11">‹</button> : null}<div className="field-stack min-w-0 flex-1">{hasScope ? <ScopeSelector workspaceName={workspaceName} projectName={projectName} projectPending={projectPending} onPressProject={onPressProject}/> : title ? <Text variant="heading" weight="bold" className="text-xl">{title}</Text> : null}</div><div className="field-stack flex flex-row flex-wrap items-center justify-end gap-1">{rightButtons}{!onBack && title !== 'Account' ? <HeaderIconButton icon="person-circle-outline" label="Account and workspace settings" onPress={() => router.push('/account')}/> : null}{showSync ? <SyncIndicator state={sync.state} pendingCount={sync.pendingCount} onPress={onPressSync ?? (() => router.push('/sync'))}/> : null}</div></div>{hasScope && title ? <Text variant="heading" weight="bold" className="block pt-4 text-2xl">{title}</Text> : null}{description ? <Text tone="secondary" className="block pt-1 text-sm">{description}</Text> : null}</header>{buildingScope ? <BuildingSelector /> : null}{stageScope ? <StageSelector /> : null}<main ref={scroller} className={cn('flex min-h-0 flex-1 flex-col px-4 pt-4', scroll ? 'overflow-y-auto pb-6' : 'overflow-hidden', className)}>{children}</main>{footer ? <footer className="shrink-0 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer> : null}</div></KeyboardRevealContext.Provider>;
}
function BuildingPage(props: PageProps) {
    const { needsChoice, isLoading } = useProjectBuilding();
    // Only a project with several buildings has a choice to make. Gating on
    // "nothing selected" also blocked the single-building project whose list had
    // not reached the device, telling a crew to choose from an empty picker —
    // and sending no buildingId is safe, the server resolves the sole one.
    const blocked = !props.buildingOptional && (isLoading || needsChoice);
    return (<PageContent {...props} footer={blocked ? undefined : props.footer}>
      {blocked ? (<div className="field-stack items-center py-12">
          <Text tone="secondary" className="text-center">
            {isLoading ? "Loading buildings…" : "Choose a building above to see its records."}
          </Text>
        </div>) : props.children}
    </PageContent>);
}
export function Page(props: PageProps) {
    return props.buildingScope ? <BuildingPage {...props}/> : <PageContent {...props}/>;
}
Page.displayName = "Page";
export type { PageProps };
