import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { htmlToText, textToParagraphHtml } from "@/lib/html";
import type { Db } from "@/db/client";
import { changeRequestsRepository, toChangeRequest } from "@/db/change-requests-repository";
import { useLocalDb } from "@/db/provider";
import { useUpdateChangeRequest } from "@/hooks/use-local-change-requests";
import { useFieldSession } from "@/lib/field-session";

function Editor({ db, projectId, changeId }: { db: Db; projectId: string; changeId: string }) {
  const query = useMemo(() => changeRequestsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const existing = useMemo(
    () => (live.data ?? []).map(toChangeRequest).find((row) => row.id === changeId),
    [live.data, changeId],
  );

  const update = useUpdateChangeRequest(db, projectId);
  const [title, setTitle] = useState<string | null>(null);
  const [descriptionHtml, setDescriptionHtml] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!existing) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  // Null means untouched, so only what the crew member actually typed is sent
  // and a background refresh cannot be clobbered by a stale render.
  const titleValue = title ?? existing.title;
  const descriptionHtmlValue =
    descriptionHtml ?? existing.descriptionHtml ?? textToParagraphHtml(existing.description ?? "");
  const costValue = cost ?? String(existing.costImpact ?? "");
  const daysValue = days ?? String(existing.timeImpactDays ?? "");

  async function submit() {
    if (saving || titleValue.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await update(changeId, {
        title: titleValue.trim(),
        description: htmlToText(descriptionHtmlValue).trim() || null,
        descriptionHtml: descriptionHtmlValue.trim() || null,
        costImpact: Number.parseFloat(costValue) || 0,
        timeImpactDays: Number.parseInt(daysValue, 10) || 0,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this change request.");
    }
  }

  return (
    <View className="gap-5">
      {error ? <Text tone="danger" className="text-[13px]">{error}</Text> : null}
      <Field label="Title" value={titleValue} onChangeText={setTitle} />
      <Text className="text-[13px] text-slate-600">Description</Text>
      <RichTextEditor value={descriptionHtmlValue} onChange={setDescriptionHtml} />
      <View className="flex-row gap-3">
        <Field label="Cost impact" value={costValue} onChangeText={setCost} keyboardType="numeric" className="flex-1" />
        <Field label="Days" value={daysValue} onChangeText={setDays} keyboardType="number-pad" className="flex-1" />
      </View>
      <Button onPress={submit} loading={saving} disabled={titleValue.trim().length === 0}>
        Save changes
      </Button>
    </View>
  );
}

export default function EditChangeRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Edit change request" onBack={() => router.back()}>
      {ready && db && projectId && id ? (
        <Editor db={db} projectId={projectId} changeId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
