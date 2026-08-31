import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { useLocalDb } from "@/db/provider";
import { useCreateChangeRequest } from "@/hooks/use-local-change-requests";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { htmlToText } from "@/lib/html";

export default function NewChangeRequest() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const create = useCreateChangeRequest(db, projectId);
  const { isOnline } = useSyncState();

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [cost, setCost] = useState("");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        title: title.trim(),
        description: htmlToText(descriptionHtml) || null,
        costImpact: Number.parseFloat(cost) || 0,
        timeImpactDays: Number.parseInt(days, 10) || 0,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this change request.");
    }
  }

  return (
    <Page
      title="New change request"
      onBack={() => router.back()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Raise change request
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
            You&apos;re offline. This is saved on your device and uploads when you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="What is changing?" autoFocus />
        <View>
          <Text weight="semibold" className="pb-2 text-[13px]">
            Description
          </Text>
          <RichTextEditor
            value={descriptionHtml}
            onChange={setDescriptionHtml}
            placeholder="Why is it needed?"
            projectId={projectId}
          />
        </View>
        <View className="flex-row gap-3">
          <Field label="Cost impact" value={cost} onChangeText={setCost} keyboardType="numeric" className="flex-1" />
          <Field label="Days" value={days} onChangeText={setDays} keyboardType="number-pad" className="flex-1" />
        </View>
      </View>
    </Page>
  );
}
