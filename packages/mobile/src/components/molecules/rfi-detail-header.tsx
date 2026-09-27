import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { RFI_STATUS_LABELS, type RfiPriority, type RfiStatus } from "@/api/rfis";
import { PendingBadge, Text } from "@/components/atoms";
import { ICON_MUTED } from "@/constants/colors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<RfiStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  Open: { bg: "bg-primary-50", text: "text-primary-700" },
  InReview: { bg: "bg-amber-50", text: "text-amber-700" },
  Answered: { bg: "bg-success-50", text: "text-success-700" },
  Closed: { bg: "bg-grey-50", text: "text-grey-500" },
  Void: { bg: "bg-error-50", text: "text-error-600" },
};

export function RfiStatusBadge({ status }: { status: RfiStatus }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.Draft;
  return (
    <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
      <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>
        {RFI_STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  );
}

function Chip({ children, tone }: { children: string; tone: "danger" | "neutral" }) {
  return (
    <View className={cn("rounded-full px-2.5 py-1", tone === "danger" ? "bg-error-50" : "bg-surface-alt")}>
      <Text
        weight="semibold"
        tone={tone === "danger" ? "danger" : "secondary"}
        className="text-[11px] uppercase"
      >
        {children}
      </Text>
    </View>
  );
}

function MetaLine({ icon, children }: { icon: "person-outline" | "calendar-outline"; children: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={14} color={ICON_MUTED} />
      <Text tone="secondary" className="text-xs">
        {children}
      </Text>
    </View>
  );
}

interface RfiDetailHeaderProps {
  number: number;
  subject: string;
  question: string;
  status: RfiStatus;
  priority: RfiPriority;
  ballInCourtName: string | null;
  dueDate: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  officialResponse: string | null;
  officialRespondedByName: string | null;
  officialRespondedAt: number | string | null;
  /** True while the official response is still queued on this device. */
  officialResponsePending: boolean;
}

export function RfiDetailHeader({
  number,
  subject,
  question,
  status,
  priority,
  ballInCourtName,
  dueDate,
  costImpact,
  scheduleImpact,
  officialResponse,
  officialRespondedByName,
  officialRespondedAt,
  officialResponsePending,
}: RfiDetailHeaderProps) {
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text weight="semibold" tone="muted" className="text-xs">
          {number > 0 ? `RFI-${number}` : "RFI · not yet numbered"}
        </Text>
        <RfiStatusBadge status={status} />
        {priority === "High" ? <Chip tone="danger">High priority</Chip> : null}
        {costImpact ? <Chip tone="neutral">Cost impact</Chip> : null}
        {scheduleImpact ? <Chip tone="neutral">Schedule impact</Chip> : null}
      </View>

      <Text weight="bold" className="text-lg">
        {subject}
      </Text>
      <Text tone="secondary" className="text-[15px]">
        {question}
      </Text>

      <MetaLine icon="person-outline">
        {ballInCourtName ? `Ball in court: ${ballInCourtName}` : "Ball in court: unassigned"}
      </MetaLine>
      {dueDate ? <MetaLine icon="calendar-outline">{`Due ${formatDate(dueDate) || dueDate}`}</MetaLine> : null}

      {officialResponse ? (
        <View className="rounded-xl bg-primary-50 p-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" tone="muted" className="flex-1 text-[10px] uppercase tracking-wide">
              Official response
            </Text>
            {officialResponsePending ? <PendingBadge /> : null}
          </View>
          <Text className="pt-1.5 text-[15px]">{officialResponse}</Text>
          {officialRespondedByName ? (
            <Text tone="muted" className="pt-1 text-xs">
              {officialRespondedByName}
              {officialRespondedAt ? ` · ${formatDateTime(officialRespondedAt)}` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

RfiDetailHeader.displayName = "RfiDetailHeader";
