import { View } from "react-native";
import type { ApprovalStatus } from "@/api/material-approvals";
import { Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

/** Labels and tones mirror the web card so a status reads the same on both clients. */
const STATUS_TONE: Record<ApprovalStatus, { bg: string; text: string }> = {
  Pending: { bg: "bg-grey-50", text: "text-grey-500" },
  Approved: { bg: "bg-success-50", text: "text-success-700" },
  Rejected: { bg: "bg-error-50", text: "text-error-600" },
  Resubmit: { bg: "bg-warning-50", text: "text-grey-500" },
};

export function MaterialApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.Pending;
  return (
    <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
      <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>
        {status}
      </Text>
    </View>
  );
}

MaterialApprovalStatusBadge.displayName = "MaterialApprovalStatusBadge";

/** Day/month only — a needed-by date has no meaningful time of day on site. */
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}
