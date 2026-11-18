import Ionicons from "@/components/atoms/icon";
import { ICON_BRAND, ICON_DANGER, ICON_INVERSE, ICON_MUTED, palette } from "@/constants/colors";
import { Text } from "./text";
/**
 * Sync state, mirroring Ernest's `useSyncState` icon table:
 *
 * | Ernest                          | here      |
 * |---------------------------------|-----------|
 * | `checkmark.icloud`              | synced    |
 * | `icloud.and.arrow.up` (offline) | pending   |
 * | animated cloud (online + queue) | syncing   |
 * | `checkmark.icloud` orange       | stale     |
 * | `exclamation.icloud` red        | error     |
 *
 * Ernest uses SF Symbols, which are iOS-only; these are the Ionicons
 * equivalents so the indicator also renders on Android.
 */
export type SyncState = "synced" | "pending" | "syncing" | "stale" | "error";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
interface SyncMeta {
    icon: IoniconName;
    color: string;
    label: string;
    spins?: boolean;
}
const SYNC_META: Record<SyncState, SyncMeta> = {
    synced: { icon: "cloud-done-outline", color: palette.grey300, label: "All changes synced" },
    pending: { icon: "cloud-upload-outline", color: ICON_MUTED, label: "Waiting to upload" },
    syncing: { icon: "sync-outline", color: ICON_BRAND, label: "Syncing", spins: true },
    stale: { icon: "cloud-done-outline", color: palette.warning600, label: "Sync conflict needs review" },
    error: { icon: "alert-circle-outline", color: ICON_DANGER, label: "Sync failed" },
};
function SpinningIcon({ icon, color }: {
    icon: IoniconName;
    color: string;
}) { return <span className="animate-spin"><Ionicons name={icon} size={20} color={color}/></span>; }
interface SyncIndicatorProps {
    state: SyncState;
    /** Queued item count, shown as a badge when there is work waiting. */
    pendingCount?: number;
    onPress?: () => void;
    /** Renders white on the blue header instead of the state colour. */
    onDark?: boolean;
}
export function SyncIndicator({ state, pendingCount = 0, onPress, onDark = false, }: SyncIndicatorProps) {
    const meta = SYNC_META[state];
    // On the blue header only `error` keeps its colour — everything else reads as
    // white so the bar stays one surface.
    const color = onDark && state !== "error" ? ICON_INVERSE : meta.color;
    const showBadge = pendingCount > 0 && (state === "pending" || state === "syncing");
    return (<button onClick={onPress} disabled={!onPress} role={onPress ? "button" : "image"} aria-label={showBadge ? `${meta.label}. ${pendingCount} waiting.` : meta.label} className={onDark ? "h-11 w-11 items-center justify-center rounded-full active:bg-white/20" : "h-11 w-11 items-center justify-center rounded-full active:bg-hairline"} type="button">
      {meta.spins ? (<SpinningIcon icon={meta.icon} color={color}/>) : (<Ionicons name={meta.icon} size={20} color={color}/>)}

      {showBadge ? (<div className={"field-stack " + (onDark ? "absolute right-1 top-1 min-w-4 items-center justify-center rounded-full bg-white px-1" : "absolute right-1 top-1 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1")}>
          <Text weight="bold" tone={onDark ? "brand" : "inverse"} className="text-[10px]">
            {pendingCount > 9 ? "9+" : String(pendingCount)}
          </Text>
        </div>) : null}
    </button>);
}
SyncIndicator.displayName = "SyncIndicator";
export type { SyncIndicatorProps };
