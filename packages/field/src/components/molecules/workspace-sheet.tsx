import { Scroller } from "@/components/atoms/scroller";
import Ionicons from "@/components/atoms/icon";
import { Modal } from "@/platform/browser";
import { useSafeAreaInsets } from "@/platform/safe-area";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { cn } from "@/lib/utils";
export interface WorkspaceOption {
    id: string;
    name: string;
}
interface WorkspaceSheetProps {
    visible: boolean;
    /** What this sheet is choosing. It is reused to pick a building, not only a workspace. */
    title?: string;
    workspaces: readonly WorkspaceOption[];
    activeId: string | undefined;
    busyId?: string;
    loading?: boolean;
    onSelect: (id: string) => void;
    onClose: () => void;
}
/**
 * Switching workspace is a one-tap change of context, not a destination — a
 * sheet keeps the crew member on the screen they were already using.
 */
export function WorkspaceSheet({ visible, title = "Switch workspace", workspaces, activeId, busyId, loading = false, onSelect, onClose, }: WorkspaceSheetProps) {
    const insets = useSafeAreaInsets();
    return (<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <div className="field-stack flex-1 justify-end bg-black-900/40">
        <button onClick={onClose} role="button" aria-label="Dismiss" className="absolute inset-0" type="button"/>
        <div className="field-stack rounded-t-3xl bg-surface" style={{ paddingBottom: insets.bottom + 12 }}>
          <div className="field-stack items-center pt-3">
            <div className="field-stack h-1 w-10 rounded-full bg-grey-100"/>
          </div>

          <div className="field-stack flex-row items-center px-5 pb-2 pt-4">
            <Text variant="heading" weight="bold" className="flex-1 text-lg">
              {title}
            </Text>
            <button onClick={onClose} role="button" aria-label="Close" className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt" type="button">
              <Ionicons name="close" size={20} color={ICON_MUTED}/>
            </button>
          </div>

          {loading ? (<div className="field-stack items-center py-10">
              <Spinner size="md"/>
            </div>) : (<Scroller className="max-h-96" contentContainerClassName="px-4 pb-2">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeId;
                return (<button key={workspace.id} onClick={() => onSelect(workspace.id)} disabled={busyId === workspace.id} role="button" aria-label={workspace.name} aria-pressed={isActive} className={cn("mb-2 min-h-16 flex-row items-center gap-3 rounded-2xl border px-4 py-3", isActive
                        ? "border-primary-200 bg-primary-50"
                        : "border-hairline bg-surface active:bg-surface-alt")} type="button">
                    <div className="field-stack h-10 w-10 items-center justify-center rounded-full bg-primary-500">
                      <Text weight="bold" tone="inverse" className="text-xs">
                        {workspace.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </div>
                    <Text weight="semibold" className="flex-1 text-base" numberOfLines={1}>
                      {workspace.name}
                    </Text>
                    {busyId === workspace.id ? (<Spinner size="sm"/>) : isActive ? (<Ionicons name="checkmark" size={20} color={ICON_BRAND}/>) : null}
                  </button>);
            })}
            </Scroller>)}
        </div>
      </div>
    </Modal>);
}
WorkspaceSheet.displayName = "WorkspaceSheet";
