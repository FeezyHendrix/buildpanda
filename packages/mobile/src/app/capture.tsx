import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { requestVoiceReport } from "@/api/voice-report";
import type { VoiceReport } from "@/api/voice-report-types";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { VoiceActionsReview } from "@/components/molecules/voice-actions-review";
import { useApplyProposedAction } from "@/hooks/use-voice-report";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";

type Phase = "record" | "processing" | "review" | "saving" | "done";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * The mic centre-tab flow: record a spoken site update, let Panda AI draft the
 * records it implies, then review and confirm before anything is written.
 * Presented as a modal over the tabs; every created record goes through the
 * offline outbox, so a confirm on-site with no signal still lands.
 */
export default function Capture() {
  const { projectId } = useFieldSession();
  const { isOnline } = useSyncState();
  const recorder = useVoiceRecorder();
  const applyAction = useApplyProposedAction();

  const [phase, setPhase] = useState<Phase>("record");
  const [report, setReport] = useState<VoiceReport | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const close = useCallback(() => router.back(), []);

  const handleStop = useCallback(async () => {
    if (!projectId) return;
    try {
      const uri = await recorder.stop();
      if (!uri) {
        setError("Nothing was recorded. Try again.");
        return;
      }
      setPhase("processing");
      setError(null);
      const result = await requestVoiceReport(projectId, uri);
      setReport(result);
      setIncluded(new Set(result.actions.map((_, index) => index)));
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the recording.");
      setPhase("record");
    }
  }, [projectId, recorder]);

  const toggle = useCallback((index: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!report) return;
    setPhase("saving");
    setError(null);
    try {
      const chosen = report.actions.filter((_, index) => included.has(index));
      for (const action of chosen) {
        await applyAction(action);
      }
      setSavedCount(chosen.length);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save these records.");
      setPhase("review");
    }
  }, [report, included, applyAction]);

  if (phase === "processing") {
    return (
      <Page title="Panda AI" showSync={false} scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner size="md" />
          <Text weight="semibold" className="pt-4 text-base">
            Listening to your note…
          </Text>
          <Text tone="secondary" className="pt-1 text-center text-[13px]">
            Transcribing and drafting your records.
          </Text>
        </View>
      </Page>
    );
  }

  if (phase === "done") {
    return (
      <Page title="Captured" showSync={false} scroll={false}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="checkmark-circle" size={56} color="#18D085" />
          <Text weight="bold" className="pt-4 text-lg">
            {savedCount} {savedCount === 1 ? "record" : "records"} queued
          </Text>
          <Text tone="secondary" className="pt-1 text-center text-[13px]">
            They&apos;ll sync when you&apos;re online. You can edit them any time from Field Tools.
          </Text>
          <View className="mt-8 w-full">
            <Button onPress={close}>Done</Button>
          </View>
        </View>
      </Page>
    );
  }

  if ((phase === "review" || phase === "saving") && report) {
    const count = included.size;
    return (
      <Page
        title="Review"
        showSync={false}
        onBack={phase === "review" ? close : undefined}
        footer={
          <Button onPress={handleConfirm} disabled={count === 0 || phase === "saving"} loading={phase === "saving"}>
            {count === 0
              ? "Select at least one"
              : `Apply ${count} ${count === 1 ? "action" : "actions"}`}
          </Button>
        }
      >
        <View className="rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[11px] uppercase">
            Heard
          </Text>
          <Text className="pt-1 text-[13px]">{report.transcript}</Text>
        </View>

        {report.actions.length === 0 ? (
          <View className="items-center py-12">
            <Text weight="semibold" className="text-base">
              Nothing to create
            </Text>
            <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
              Panda AI didn&apos;t find anything actionable. Try naming a specific task, RFI or delivery.
            </Text>
          </View>
        ) : (
          <View className="pt-4">
            <Text tone="secondary" className="pb-3 text-[13px]">
              Tap to include or exclude. Nothing is saved or updated until you confirm.
            </Text>
            <VoiceActionsReview actions={report.actions} includedIndexes={included} onToggle={toggle} />
          </View>
        )}

        {error ? (
          <View className="mt-4 rounded-xl bg-error-50 px-4 py-3">
            <Text tone="danger" className="text-sm">
              {error}
            </Text>
          </View>
        ) : null}
      </Page>
    );
  }

  // phase === "record"
  const canRecord = isOnline && Boolean(projectId);
  return (
    <Page title="Voice note" showSync={false} onBack={close} scroll={false}>
      <View className="flex-1 items-center justify-between py-6">
        <Text tone="secondary" className="px-4 pt-6 text-center text-[15px]">
          Describe what happened on site — Panda AI drafts the RFIs, logs and orders for you to review.
        </Text>

        <View className="items-center">
          <Text weight="bold" className="pb-8 text-5xl">
            {formatClock(recorder.seconds)}
          </Text>
          <Pressable
            onPress={recorder.isRecording ? handleStop : recorder.start}
            disabled={!canRecord}
            accessibilityRole="button"
            accessibilityLabel={recorder.isRecording ? "Stop recording" : "Start recording"}
            className={cn(
              "h-24 w-24 items-center justify-center rounded-full",
              recorder.isRecording ? "bg-error-500" : "bg-primary-500",
              !canRecord && "opacity-40",
            )}
            style={{
              shadowColor: recorder.isRecording ? "#E9301C" : "#004DE7",
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Ionicons name={recorder.isRecording ? "stop" : "mic"} size={40} color="#FFFFFF" />
          </Pressable>
          <Text tone="secondary" className="pt-4 text-[13px]">
            {recorder.isRecording ? "Tap to stop" : "Tap to start recording"}
          </Text>
        </View>

        <View className="w-full px-4">
          {!isOnline ? (
            <View className="rounded-xl bg-surface-alt px-4 py-3">
              <Text tone="secondary" className="text-center text-[13px]">
                Panda AI needs a connection to turn a recording into records. Reconnect to capture by voice — your typed
                tools keep working offline.
              </Text>
            </View>
          ) : null}
          {error || recorder.error ? (
            <View className="mt-2 rounded-xl bg-error-50 px-4 py-3">
              <Text tone="danger" className="text-center text-sm">
                {error ?? recorder.error}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Page>
  );
}
