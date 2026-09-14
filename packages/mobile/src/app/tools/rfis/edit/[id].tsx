import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { RFI_PRIORITIES, type RfiPriority } from "@/api/rfis";
import { Button, Field, FieldLabel, OptionRow, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { isDueDateValid, RfiFormFields } from "@/components/molecules/rfi-form-fields";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalRfi, useUpdateLocalRfi } from "@/hooks/use-local-rfis";
import { useProjectAssignees } from "@/hooks/use-participants";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText, textToParagraphHtml } from "@/lib/html";
import { useSyncState } from "@/lib/sync-provider";

type BallInCourt = { id: string | null; name: string | null };

function LoadingPage() {
  return (
    <Page title="Edit RFI" onBack={() => router.back()}>
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    </Page>
  );
}

/** Owns the page so the footer's Save button and the draft state live together. */
function Editor({ db, projectId, rfiId }: { db: Db; projectId: string; rfiId: string }) {
  const { data: existing } = useLocalRfi(db, rfiId);
  const assignees = useProjectAssignees(projectId);
  const { isOnline } = useSyncState();

  const update = useUpdateLocalRfi();
  const [subject, setSubject] = useState<string | null>(null);
  const [questionHtml, setQuestionHtml] = useState<string | null>(null);
  const [priority, setPriority] = useState<RfiPriority | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [costImpact, setCostImpact] = useState<boolean | null>(null);
  const [scheduleImpact, setScheduleImpact] = useState<boolean | null>(null);
  const [ballInCourt, setBallInCourt] = useState<BallInCourt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!existing) return <LoadingPage />;

  // Null means untouched, so only what was actually typed is sent and a
  // background refresh cannot be clobbered by a stale render.
  const subjectValue = subject ?? existing.subject;
  const questionHtmlValue =
    questionHtml ?? existing.questionHtml ?? textToParagraphHtml(existing.question);
  const priorityValue = priority ?? existing.priority;
  const dueDateValue = dueDate ?? existing.dueDate ?? "";
  const costImpactValue = costImpact ?? existing.costImpact;
  const scheduleImpactValue = scheduleImpact ?? existing.scheduleImpact;
  const ballInCourtValue: BallInCourt = ballInCourt ?? {
    id: existing.ballInCourtId,
    name: existing.ballInCourtName,
  };

  const canSubmit = subjectValue.trim().length > 0 && isDueDateValid(dueDateValue) && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await update(rfiId, {
        subject: subjectValue.trim(),
        question: htmlToText(questionHtmlValue).trim(),
        questionHtml: questionHtmlValue.trim() || null,
        priority: priorityValue,
        dueDate: dueDateValue.trim() || null,
        costImpact: costImpactValue,
        scheduleImpact: scheduleImpactValue,
        ballInCourtId: ballInCourtValue.id,
        ballInCourtName: ballInCourtValue.name,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this RFI.");
    }
  }

  return (
    <Page
      title="Edit RFI"
      onBack={() => router.back()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Save changes
        </Button>
      }
    >
      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {error}
          </Text>
        </View>
      ) : null}

      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            You&apos;re offline. Your changes are saved on your device and upload when you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <Field label="Subject" value={subjectValue} onChangeText={setSubject} />
        <View className="gap-2">
          <FieldLabel>Question</FieldLabel>
          <RichTextEditor value={questionHtmlValue} onChange={setQuestionHtml} />
        </View>
        <OptionRow label="Priority" options={RFI_PRIORITIES} value={priorityValue} onChange={setPriority} />
        <RfiFormFields
          dueDate={dueDateValue}
          onDueDateChange={setDueDate}
          costImpact={costImpactValue}
          onCostImpactChange={setCostImpact}
          scheduleImpact={scheduleImpactValue}
          onScheduleImpactChange={setScheduleImpact}
          ballInCourtId={ballInCourtValue.id}
          ballInCourtName={ballInCourtValue.name}
          onBallInCourtChange={(id, name) => setBallInCourt({ id, name })}
          assignees={assignees}
        />
      </View>
    </Page>
  );
}

export default function EditRfi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!(ready && db && projectId && id)) return <LoadingPage />;
  return <Editor db={db} projectId={projectId} rfiId={id} />;
}
