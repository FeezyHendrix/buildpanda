import { withProjectPermission } from "@/components/molecules/permission-gate";
/**
 * Placeholder route holding the centre tab slot. The tab's button (see
 * `(tabs)/_layout.tsx`) pushes to `/capture` instead of navigating here, so this
 * screen is never actually shown — expo-router just needs the route to exist for
 * the raised mic button to render in place.
 */
function RecordSlot() {
  return null;
}

export default withProjectPermission(RecordSlot, "/(tabs)/record");
