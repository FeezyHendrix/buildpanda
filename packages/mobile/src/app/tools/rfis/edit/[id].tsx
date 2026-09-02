import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { rfisRepository, toRfi } from "@/db/rfis-repository";
import { useLocalDb } from "@/db/provider";
import { useUpdateLocalRfi } from "@/hooks/use-local-rfis";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

const PRIORITIES = ["Low", "Normal", "High"] as const;

function Editor({ db, projectId, rfiId }: { db: Db; projectId: string; rfiId: string }) {
  const query = useMemo(() => rfisRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const existing = useMemo(
    () => (live.data ?? []).map(toRfi).find((row) => row.id === rfiId),
    [live.data, rfiId],
  );

  const update = useUpdateLocalRfi();
  const [subject, setSubject] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!existing) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  // Null means untouched, so only what was actually typed is sent and a
  // background refresh cannot be clobbered by a stale render.
  const subjectValue = subject ?? existing.subject;
  const questionValue = question ?? existing.question;
  const priorityValue = priority ?? existing.priority;

  async function submit() {
    if (saving || subjectValue.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await update(rfiId, {
        subject: subjectValue.trim(),
        question: questionValue.trim(),
        priority: priorityValue as never,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this RFI.");
    }
  }

  return (
    <View className="gap-5">
      {error ? <Text tone="danger" className="text-[13px]">{error}</Text> : null}

      <Field label="Subject" value={subjectValue} onChangeText={setSubject} />
      <Field label="Question" value={questionValue} onChangeText={setQuestion} multiline />

      <View className="gap-2">
        <Text weight="semibold" tone="secondary" className="text-[13px]">
          Priority
        </Text>
        <View className="flex-row gap-2">
          {PRIORITIES.map((option) => {
            const active = option === priorityValue;
            return (
              <Pressable
                key={option}
                onPress={() => setPriority(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={cn(
                  "min-h-11 flex-1 items-center justify-center rounded-xl px-3",
                  active ? "bg-primary-500" : "bg-surface-alt",
                )}
              >
                <Text weight="semibold" tone={active ? "inverse" : "secondary"} className="text-[13px]">
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button onPress={submit} loading={saving} disabled={subjectValue.trim().length === 0}>
        Save changes
      </Button>
    </View>
  );
}

export default function EditRfi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Edit RFI" onBack={() => router.back()}>
      {ready && db && projectId && id ? (
        <Editor db={db} projectId={projectId} rfiId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
