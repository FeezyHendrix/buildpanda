import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { RFI_PRIORITIES, type RfiPriority } from "@/api/rfis";
import { Button, Field, OptionRow, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useCreateLocalRfi } from "@/hooks/use-local-rfis";
import { useSyncState } from "@/lib/sync-provider";

export default function NewRfi() {
  const createRfi = useCreateLocalRfi();
  const { isOnline } = useSyncState();

  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<RfiPriority>("Normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = subject.trim().length > 0 && question.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // Writes to SQLite and queues the push; it does not wait on the network,
      // so this succeeds with no signal.
      await createRfi({
        subject: subject.trim(),
        question: question.trim(),
        priority,
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
        <Field
          label="Question"
          value={question}
          onChangeText={setQuestion}
          placeholder="Describe the query"
          multiline
          className="min-h-32"
        />
        <OptionRow
          label="Priority"
          options={RFI_PRIORITIES}
          value={priority}
          onChange={setPriority}
        />
      </View>
    </Page>
  );
}
