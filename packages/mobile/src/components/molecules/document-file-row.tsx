import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_FAINT, ICON_SUCCESS } from "@/constants/colors";
import { DOCUMENT_GROUP, type LocalDocument } from "@/db/documents-repository";
import { cn } from "@/lib/utils";

function iconFor(fileName: string): React.ComponentProps<typeof Ionicons>["name"] {
  if (/\.pdf$/i.test(fileName)) return "document-outline";
  if (/\.(xlsx?|csv)$/i.test(fileName)) return "grid-outline";
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(fileName)) return "image-outline";
  return "document-text-outline";
}

/**
 * One file in a folder or the recent list.
 *
 * A row still waiting to upload opens the copy staged on this device; there
 * is no server record to review or version yet, so it goes to the viewer
 * rather than the plan or document screen.
 */
export function DocumentFileRow({
  doc,
  onOpen,
}: {
  doc: LocalDocument;
  onOpen: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePress() {
    if (doc.isPendingSync) {
      if (!doc.stagedUri) return;
      router.push(
        `/tools/documents/view?uri=${encodeURIComponent(doc.stagedUri)}&name=${encodeURIComponent(doc.fileName)}` as never,
      );
      return;
    }
    setBusy(true);
    try {
      await onOpen(doc.id);
    } finally {
      setBusy(false);
    }
    router.push(
      (doc.group === DOCUMENT_GROUP.PLAN
        ? `/tools/plan-review?documentId=${doc.id}`
        : `/tools/documents/${doc.id}`) as never,
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
        <Ionicons name={iconFor(doc.fileName)} size={18} color={ICON_BRAND} />
      </View>
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
          {doc.fileName}
        </Text>
        <View className="flex-row items-center gap-2 pt-0.5">
          <Text tone="secondary" className="text-xs">
            {[doc.category, doc.size, doc.versionNo > 0 ? `v${doc.versionNo}` : null].filter(Boolean).join(" · ")}
          </Text>
          {doc.status ? (
            <View
              className={cn(
                "rounded-full px-1.5 py-0.5",
                doc.status === "Verified" ? "bg-success-50" : doc.status === "Expired" ? "bg-error-50" : "bg-surface-alt",
              )}
            >
              <Text
                weight="semibold"
                tone={doc.status === "Verified" ? "brand" : doc.status === "Expired" ? "danger" : "secondary"}
                className="text-[9px] uppercase"
              >
                {doc.status}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {doc.isPendingSync ? (
        <PendingBadge />
      ) : busy ? (
        <Spinner size="xs" />
      ) : doc.isAvailableOffline ? (
        <Ionicons name="cloud-done-outline" size={18} color={ICON_SUCCESS} />
      ) : (
        <Ionicons name="cloud-download-outline" size={18} color={ICON_FAINT} />
      )}
    </Pressable>
  );
}
DocumentFileRow.displayName = "DocumentFileRow";
