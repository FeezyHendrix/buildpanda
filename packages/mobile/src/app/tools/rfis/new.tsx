import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { RFI_PRIORITIES, type RfiPriority } from "@/api/rfis";
import { Button, Field, FieldLabel, OptionRow, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { isDueDateValid, RfiFormFields } from "@/components/molecules/rfi-form-fields";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { useCreateLocalRfi } from "@/hooks/use-local-rfis";
import { useProjectAssignees } from "@/hooks/use-participants";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText } from "@/lib/html";
import { useSyncState } from "@/lib/sync-provider";

export default function NewRfi() {
  const { projectId } = useFieldSession();
  const createRfi = useCreateLocalRfi();
  const assignees = useProjectAssignees(projectId);
  const { isOnline } = useSyncState();

  const [subject, setSubject] = useState("");
  const [questionHtml, setQuestionHtml] = useState("");
  const [priority, setPriority] = useState<RfiPriority>("Normal");
  const [dueDate, setDueDate] = useState("");
  const [costImpact, setCostImpact] = useState(false);
  const [scheduleImpact, setScheduleImpact] = useState(false);
  const [ballInCourt, setBallInCourt] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionText = htmlToText(questionHtml).trim();
  const canSubmit =
    subject.trim().length > 0 && questionText.length > 0 && isDueDateValid(dueDate) && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // Writes to SQLite and queues the push; it does not wait on the network,
      // so this succeeds with no signal.
      await createRfi({
        subject: subject.trim(),
        question: questionText,
        questionHtml: questionHtml || null,
        priority,
        dueDate: dueDate.trim() || null,
        costImpact,
        scheduleImpact,
        ballInCourtId: ballInCourt.id,
        ballInCourtName: ballInCourt.name,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this RFI.");
    }
  }

  return (
    <Page
      title="New RFI"
      onBack={() => router.back()}
      footer={
        <Button onPress={handleSubmit} disabled={!canSubmit} loading={saving}>
          Raise RFI
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
            You&apos;re offline. This RFI is saved on your device and uploads when you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <Field
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="What do you need answered?"
          autoFocus
        />
        <View className="gap-2">
          <FieldLabel>Question</FieldLabel>
          <RichTextEditor
            value={questionHtml}
            onChange={setQuestionHtml}
            placeholder="Describe the query"
          />
        </View>
        <OptionRow
          label="Priority"
          options={RFI_PRIORITIES}
          value={priority}
          onChange={setPriority}
        />
        <RfiFormFields
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          costImpact={costImpact}
          onCostImpactChange={setCostImpact}
          scheduleImpact={scheduleImpact}
          onScheduleImpactChange={setScheduleImpact}
          ballInCourtId={ballInCourt.id}
          ballInCourtName={ballInCourt.name}
          onBallInCourtChange={(id, name) => setBallInCourt({ id, name })}
          assignees={assignees}
        />
      </View>
    </Page>
  );
}
