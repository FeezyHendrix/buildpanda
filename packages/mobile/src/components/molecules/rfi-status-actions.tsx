import { Alert, View } from "react-native";
import { RFI_REOPENABLE_STATUSES, type RfiStatus, type RfiStatusTransition } from "@/api/rfis";
import { Button, Text } from "@/components/atoms";

interface RfiStatusActionsProps {
  status: RfiStatus;
  /** True while the RFI's own create is still queued: there is no server id to transition. */
  notYetOnServer: boolean;
  busy: boolean;
  onTransition: (status: RfiStatusTransition) => void;
}

/**
 * Close / Void / Reopen, offered per status exactly as the server accepts
 * them: close or void anything still live; reopen an answered or closed one.
 * A voided RFI is final — the server refuses to reopen it.
 */
export function RfiStatusActions({ status, notYetOnServer, busy, onTransition }: RfiStatusActionsProps) {
  const isLive = status !== "Closed" && status !== "Void";
  const canReopen = RFI_REOPENABLE_STATUSES.includes(status);

  if (notYetOnServer) {
    return (
      <Text tone="secondary" className="text-[13px]">
        Close or void this RFI once it has synced to the server.
      </Text>
    );
  }
  if (!isLive && !canReopen) return null;

  // Void is not undoable, so it must not happen on a single stray tap.
  function confirmVoid() {
    Alert.alert("Void this RFI?", "A voided RFI cannot be reopened.", [
      { text: "Cancel", style: "cancel" },
      { text: "Void", style: "destructive", onPress: () => onTransition("Void") },
    ]);
  }

  return (
    <View className="flex-row gap-2">
      {isLive ? (
        <Button variant="secondary" className="flex-1" loading={busy} onPress={() => onTransition("Closed")}>
          Close RFI
        </Button>
      ) : null}
      {canReopen ? (
        <Button variant="secondary" className="flex-1" loading={busy} onPress={() => onTransition("Open")}>
          Reopen
        </Button>
      ) : null}
      {isLive ? (
        <Button variant="danger" className="flex-1" loading={busy} onPress={confirmVoid}>
          Void
        </Button>
      ) : null}
    </View>
  );
}

RfiStatusActions.displayName = "RfiStatusActions";
