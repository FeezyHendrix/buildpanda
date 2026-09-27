import { applyVoiceActionBatch, type AppliedVoiceAction } from "@/lib/voice-action-batch";
import { goBack } from "@/lib/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { requestVoiceReport } from "@/api/voice-report";
import type { VoiceReport } from "@/api/voice-report-types";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { VoiceActionsReview } from "@/components/molecules/voice-actions-review";
import { ICON_DANGER, ICON_INVERSE, ICON_SUCCESS, palette } from "@/constants/colors";
import { useApplyProposedAction } from "@/hooks/use-voice-report";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";
import {
  mergeMissingValues,
  outstandingCount,
  type MissingFieldValues,
} from "@/lib/voice-missing-fields";

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
  // the recording already happened, in a sheet over whatever the crew member
  // was looking at; this page exists for the part that is genuinely a task
  const { uri, seconds } = useLocalSearchParams<{ uri?: string; seconds?: string }>();
  const { projectId } = useFieldSession();
  const { isOnline } = useSyncState();
  const recorder = useVoiceRecorder();
  const applyAction = useApplyProposedAction();

  const [phase, setPhase] = useState<Phase>(uri ? "processing" : "record");
  const [report, setReport] = useState<VoiceReport | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [fieldValues, setFieldValues] = useState<MissingFieldValues>({});
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const completed = useRef(new Map<number, AppliedVoiceAction>());
  const confirming = useRef(false);
  const [appliedIndexes, setAppliedIndexes] = useState<ReadonlySet<number>>(new Set());
  const [recordingUri, setRecordingUri] = useState(uri ?? null);
  const processing = useRef<AbortController | null>(null);

  useEffect(() => () => processing.current?.abort(), []);

  const close = useCallback(() => goBack(), []);

  const transcribe = useCallback(
    async (audioUri: string) => {
      if (!projectId) return;
      processing.current?.abort();
      const controller = new AbortController();
      processing.current = controller;
      setRecordingUri(audioUri);
      setPhase("processing");
      setError(null);
      try {
        const result = await requestVoiceReport(projectId, audioUri, controller.signal);
        if (controller.signal.aborted) return;
        completed.current.clear();
        setAppliedIndexes(new Set());
        setReport(result);
        setIncluded(new Set(result.actions.map((_, index) => index)));
        setFieldValues({});
        setPhase("review");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not process the recording.");
          setPhase("record");
        }
      } finally {
        if (processing.current === controller) processing.current = null;
      }
    },
    [projectId],
  );

  const started = useRef(false);
  useEffect(() => {
    if (!uri || started.current || !projectId) return;
    started.current = true;
    void transcribe(uri);
  }, [uri, projectId, transcribe]);

  const handleStop = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) {
      setError("Nothing was recorded. Try again.");
      return;
    }
    await transcribe(recording.uri);
  }, [recorder, transcribe]);

  const toggle = useCallback((index: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const changeField = useCallback((actionIndex: number, fieldName: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [actionIndex]: { ...prev[actionIndex], [fieldName]: value },
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!report || confirming.current) return;
    if (outstandingCount(report.actions, included, fieldValues) > 0) return;
    confirming.current = true;
    setPhase("saving");
    setError(null);
    try {
      const chosen = report.actions
        .map((action, index) => ({ action, index }))
        .filter((entry) => included.has(entry.index));
      await applyVoiceActionBatch(
        chosen.map(({ action, index }) => ({ index, action: mergeMissingValues(action, fieldValues[index]) })),
        completed.current,
        applyAction,
      );
      setSavedCount(completed.current.size);
      setAwaitingCount([...completed.current.values()].filter((result) => result?.awaitingApproval).length);
      setPhase("done");
    } catch (err) {
      const count = completed.current.size;
      setError(`${count > 0 ? `${count} already saved. Retry the remaining actions. ` : ""}${err instanceof Error ? err.message : "Could not save these records."}`);
      setPhase("review");
    } finally {
      confirming.current = false;
      setAppliedIndexes(new Set(completed.current.keys()));
      setIncluded((previous) => new Set([...previous].filter((index) => !completed.current.has(index))));
    }

  }, [report, included, fieldValues, applyAction]);

  if (phase === "processing") {
    return (
      <Page title="Panda AI" showSync={false} scroll={false} onBack={() => {
        processing.current?.abort();
        setPhase("record");
      }}>
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
          <Ionicons name="checkmark-circle" size={56} color={ICON_SUCCESS} />
          <Text weight="bold" className="pt-4 text-lg">
            {savedCount} {savedCount === 1 ? "record" : "records"} queued
          </Text>
          <Text tone="secondary" className="pt-1 text-center text-[13px]">
            They&apos;ll sync when you&apos;re online. You can edit them any time from Field Tools.
          </Text>
          {awaitingCount > 0 ? (
            <Text className="pt-2 text-center text-[13px] text-amber-600">
              {awaitingCount} awaiting a manager&apos;s approval before it counts toward stock.
            </Text>
          ) : null}
          <View className="mt-8 w-full">
            <Button onPress={close}>Done</Button>
          </View>
        </View>
      </Page>
    );
  }

  if ((phase === "review" || phase === "saving") && report) {
    const count = included.size;
    const outstanding = outstandingCount(report.actions, included, fieldValues);
    return (
      <Page
        title="Review"
        showSync={false}
        onBack={phase === "review" ? close : undefined}
        footer={
          <View className="gap-2">
            {outstanding > 0 ? (
              <View className="flex-row items-center justify-center gap-1.5">
                <Ionicons name="alert-circle" size={14} color={ICON_DANGER} />
                <Text tone="danger" weight="semibold" className="text-[13px]">
                  Fill in {outstanding} {outstanding === 1 ? "detail" : "details"} before saving
                </Text>
              </View>
            ) : null}
            <Button
              onPress={handleConfirm}
              disabled={count === 0 || outstanding > 0 || phase === "saving"}
              loading={phase === "saving"}
            >
              {count === 0
                ? "Select at least one"
                : `Apply ${count} ${count === 1 ? "action" : "actions"}`}
            </Button>
          </View>
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
            <Text weight="semibold" className="text-center text-base">
              Nothing to create
            </Text>
            <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
              Panda AI didn&apos;t find anything actionable. Try naming a specific task, RFI or delivery.
            </Text>
          </View>
        ) : (
          <View className="pt-4">
            <Text tone="secondary" className="pb-3 text-[13px]">
              Tap a card to include or exclude it. Anything Panda AI couldn&apos;t hear is asked for below.
              Nothing is saved or updated until you confirm.
            </Text>
            <VoiceActionsReview
              actions={report.actions}
              includedIndexes={included}
              appliedIndexes={appliedIndexes}
              values={fieldValues}
              onToggle={toggle}
              onChangeField={changeField}
            />
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
            disabled={!canRecord && !recorder.isRecording}
            accessibilityRole="button"
            accessibilityLabel={recorder.isRecording ? "Stop recording" : "Start recording"}
            className={cn(
              "h-24 w-24 items-center justify-center rounded-full",
              recorder.isRecording ? "bg-error-500" : "bg-primary-500",
              !canRecord && "opacity-40",
            )}
            style={{
              shadowColor: recorder.isRecording ? palette.error500 : palette.primary500,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Ionicons name={recorder.isRecording ? "stop" : "mic"} size={40} color={ICON_INVERSE} />
          </Pressable>
          <Text tone="secondary" className="pt-4 text-[13px]">
            {recorder.isRecording ? "Tap to stop" : "Tap to start recording"}
          </Text>
        </View>

        <View className="w-full gap-3 px-4">
          {recordingUri && !recorder.isRecording ? (
            <Button onPress={() => transcribe(recordingUri)} disabled={!isOnline || !projectId}>
              Retry this recording
            </Button>
          ) : null}
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
