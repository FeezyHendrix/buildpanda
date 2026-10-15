import { ContentText } from "@/components/rich-text/rich-content";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { TemplateAnswer, TemplateResponses } from "@/api/daily-log-templates";
import { Button, OptionRow, Spinner, Text } from "@/components/atoms";
import { FieldLabel } from "@/components/atoms/input";
import { Page } from "@/components/molecules/page";
import { TemplateFormFields } from "@/components/molecules/template-form-fields";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { defaultTemplate } from "@/db/daily-log-templates-repository";
import { todayIso } from "@/db/daily-logs-repository";
import { useLocalDb } from "@/db/provider";
import { useDailyLogTemplates } from "@/hooks/use-daily-log-templates";
import { useAddTemplateEntry } from "@/hooks/use-daily-logs";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useSession } from "@/lib/auth-client";
import { cleanResponses, missingRequired } from "@/lib/daily-log-template";
import { formatLongDayLabel, isIsoDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";

// Filling the admin's daily log form is authoring a record, so it is a page.
// Forms are built on the web; here they are only filled, offline if need be.

function FillForm({ db, projectId, logDate, buildingId }: { db: Db; projectId: string; logDate: string; buildingId: string }) {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const templates = useDailyLogTemplates(db, projectId);
  const addEntry = useAddTemplateEntry(db, projectId);
  const { data: session } = useSession();
  const [chosenId, setChosenId] = useState<string | null>(templateId ?? null);
  const [responses, setResponses] = useState<TemplateResponses>({});
  const [notesHtml, setNotesHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template =
    templates.data.find((t) => t.id === chosenId) ?? defaultTemplate(templates.data) ?? templates.data[0] ?? null;
  const missing = template ? missingRequired(template.fields, cleanResponses(template.fields, responses)) : [];

  async function handleSubmit() {
    if (!template || missing.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await addEntry(logDate, {
        template,
        responses,
        notesHtml: notesHtml.trim() || null,
        authorName: session?.user.name ?? "You",
        buildingId,
      });
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add your log.");
    } finally {
      setSaving(false);
    }
  }

  const footer = template ? (
    <View className="gap-2">
      {missing.length > 0 ? (
        <Text tone="secondary" className="text-xs" numberOfLines={2}>Still required: {missing.join(", ")}</Text>
      ) : null}
      <Button onPress={handleSubmit} loading={saving} disabled={missing.length > 0}>Add to daily log</Button>
    </View>
  ) : null;

  return (
    <Page title={template?.name ?? "Daily log form"} description={formatLongDayLabel(logDate) || logDate} onBack={() => goBack()} footer={footer}>
      {templates.isPending ? (
        <View className="items-center py-12"><Spinner size="md" /></View>
      ) : !template ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">No daily log form yet</Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            An admin can set one up on the web under Settings, Daily log. Connect once to download it.
          </Text>
        </View>
      ) : (
        <View className="gap-5">
          {error ? (
            <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
          ) : null}
          {templates.data.length > 1 ? (
            <OptionRow
              label="Form"
              options={templates.data.map((t) => ({ value: t.id, label: t.name }))}
              value={template.id}
              onChange={(next) => {
                setChosenId(next);
                setResponses({});
              }}
            />
          ) : null}
          {template.description ? <ContentText tone="secondary" className="text-[13px]" value={template.description} /> : null}
          <TemplateFormFields
            fields={template.fields}
            responses={responses}
            onChange={(id, value: TemplateAnswer) => setResponses((current) => ({ ...current, [id]: value }))}
          />
          <View className="gap-2">
            <FieldLabel>Notes and photos (optional)</FieldLabel>
            <RichTextEditor value={notesHtml} onChange={setNotesHtml} placeholder="Anything the form doesn't cover" projectId={projectId} />
          </View>
        </View>
      )}
    </Page>
  );
}

function FillDailyLog() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { projectId } = useFieldSession();
  const { buildingId } = useProjectBuilding();
  const { db, ready } = useLocalDb();
  const logDate = date && isIsoDate(date) ? date : todayIso();

  if (!ready || !db || !projectId || !buildingId) {
    return (
      <Page buildingScope title="Daily log form" onBack={() => goBack()}>
        <View className="items-center py-12"><Spinner size="md" /></View>
      </Page>
    );
  }
  return <FillForm key={`${projectId}:${buildingId}:${logDate}`} db={db} projectId={projectId} logDate={logDate} buildingId={buildingId} />;
}

export default withProjectPermission(FillDailyLog, "/tools/daily-log/fill");
