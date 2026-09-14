import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { CHANGE_STATUSES, type ChangeStatus } from "@/api/change-requests";
import { Button, Field, FieldLabel, OptionRow, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { htmlToText, textToParagraphHtml } from "@/lib/html";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalChangeRequest, useUpdateChangeRequest } from "@/hooks/use-local-change-requests";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

interface Draft {
  title: string;
  descriptionHtml: string;
  status: ChangeStatus;
  cost: string;
  days: string;
}

function EditorForm({
  db,
  projectId,
  changeId,
  initial,
}: {
  db: Db;
  projectId: string;
  changeId: string;
  initial: Draft;
}) {
  const update = useUpdateChangeRequest(db, projectId);
  const { isOnline } = useSyncState();
  const [title, setTitle] = useState(initial.title);
  const [descriptionHtml, setDescriptionHtml] = useState(initial.descriptionHtml);
  const [status, setStatus] = useState<ChangeStatus>(initial.status);
  const [cost, setCost] = useState(initial.cost);
  const [days, setDays] = useState(initial.days);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await update(changeId, {
        title: title.trim(),
        description: htmlToText(descriptionHtml).trim() || null,
        descriptionHtml: descriptionHtml.trim() || null,
        status,
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
      title="Edit change request"
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
            You&apos;re offline. This is saved on your device and uploads when you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <Field label="Title" value={title} onChangeText={setTitle} />
        <View className="gap-2">
          <FieldLabel>Description</FieldLabel>
          <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} projectId={projectId} />
        </View>
        <OptionRow label="Status" options={CHANGE_STATUSES} value={status} onChange={setStatus} />
        <View className="flex-row gap-3">
          <Field label="Cost impact" value={cost} onChangeText={setCost} keyboardType="numeric" className="flex-1" />
          <Field label="Days" value={days} onChangeText={setDays} keyboardType="number-pad" className="flex-1" />
        </View>
      </View>
    </Page>
  );
}

function Editor({ db, projectId, changeId }: { db: Db; projectId: string; changeId: string }) {
  const { data: existing } = useLocalChangeRequest(db, changeId);

  if (!existing) {
    return (
      <Page title="Edit change request" onBack={() => router.back()}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }

  // The form is seeded once from the local row (keyed on the id) so a
  // background refresh cannot clobber what the crew member is typing.
  return (
    <EditorForm
      key={existing.id}
      db={db}
      projectId={projectId}
      changeId={changeId}
      initial={{
        title: existing.title,
        descriptionHtml: existing.descriptionHtml ?? textToParagraphHtml(existing.description ?? ""),
        status: existing.status,
        cost: existing.costImpact ? String(existing.costImpact) : "",
        days: existing.timeImpactDays ? String(existing.timeImpactDays) : "",
      }}
    />
  );
}

export default function EditChangeRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!(ready && db && projectId && id)) {
    return (
      <Page title="Edit change request" onBack={() => router.back()}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }

  return <Editor db={db} projectId={projectId} changeId={id} />;
}
