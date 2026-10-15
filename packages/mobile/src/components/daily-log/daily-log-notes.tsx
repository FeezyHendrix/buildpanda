import { hasRichContent } from "@buildpanda/rich-content";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, PendingBadge, Text } from "@/components/atoms";
import { RichContent } from "@/components/rich-text/rich-content";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { defaultTemplate } from "@/db/daily-log-templates-repository";
import { useDailyLogTemplates } from "@/hooks/use-daily-log-templates";
import { useAddDailyLogEntry, type useDailyLogDay } from "@/hooks/use-daily-logs";
import { useSession } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/dates";
import { features } from "@/lib/feature-access";
import { htmlToText } from "@/lib/html";

interface Props {
  db: Db;
  projectId: string;
  buildingId: string;
  logDate: string;
  editable: boolean;
  entries: ReturnType<typeof useDailyLogDay>["entries"];
  activities: ReturnType<typeof useDailyLogDay>["activities"];
}

/** Notes belong to a saved day's record. Programme hours are optional detail. */
export function DailyLogNotes({ db, projectId, buildingId, logDate, editable, entries, activities }: Props) {
  const templates = useDailyLogTemplates(db, projectId);
  const form = defaultTemplate(templates.data) ?? templates.data[0];
  const addEntry = useAddDailyLogEntry(db, projectId);
  const { data: session } = useSession();
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHours, setShowHours] = useState(false);

  async function addNote() {
    if (!editable || saving || !hasRichContent(html)) return;
    setSaving(true);
    setError("");
    try {
      await addEntry(logDate, htmlToText(html), session?.user.name ?? "You", html, buildingId);
      setHtml("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this site note.");
    } finally { setSaving(false); }
  }

  return <View className="gap-5">
    <View className="gap-3">
      <Text weight="bold" className="text-base">Site notes</Text>
      {entries.length === 0 ? <Text tone="secondary">No site notes yet. Add observations, photos or a completed form for this day.</Text> : (
        <Card>{entries.map((entry) => <View key={entry.id} className="gap-2 border-b border-hairline px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" className="flex-1 text-[13px]">{entry.authorName || "You"}</Text>
            {entry.isPendingSync ? <PendingBadge /> : null}
          </View>
          <Text tone="secondary" className="text-xs">{formatDateTime(new Date(entry.createdAt).toISOString())}{entry.voided ? " · Voided" : ""}</Text>
          <View style={{ opacity: entry.voided ? 0.5 : 1 }}><RichContent html={entry.bodyHtml} text={entry.bodyText} /></View>
        </View>)}</Card>
      )}
      {editable && form ? <Button variant="secondary" permission={features.dailyLog.actions.create}
        onPress={() => router.push(`/tools/daily-log/fill?date=${logDate}&templateId=${encodeURIComponent(form.id)}` as never)}>
        {`Fill ${form.name}`}
      </Button> : null}
      {editable ? <View className="gap-3">
        <RichTextEditor label="Site note" value={html} onChange={setHtml} projectId={projectId} placeholder="What happened on site?" />
        {error ? <Text tone="danger">{error}</Text> : null}
        <Button permission={features.dailyLog.actions.create} onPress={addNote} loading={saving} disabled={!hasRichContent(html)}>Add site note</Button>
      </View> : null}
    </View>
    <View className="gap-3 border-t border-hairline pt-2">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHours }} onPress={() => setShowHours((value) => !value)}
        className="min-h-11 flex-row items-center justify-between gap-3">
        <Text weight="semibold">Programme hours{activities.length > 0 ? ` (${activities.length})` : " (optional)"}</Text>
        <Text tone="brand">{showHours ? "Hide" : "Show"}</Text>
      </Pressable>
      {showHours ? <View className="gap-3">
        <Text tone="secondary" className="text-sm">Record time spent on activities in the project programme.</Text>
        {activities.map((activity) => <View key={activity.id} className="min-h-11 flex-row items-center gap-3">
          <Text className="flex-1">{activity.activityName}</Text>
          <Text weight="semibold">{activity.hoursLogged}h</Text>
          {activity.isPendingSync ? <PendingBadge /> : null}
        </View>)}
        {editable ? <Button variant="secondary" permission={features.dailyLog.actions.create}
          onPress={() => router.push(`/tools/daily-log/log-activity?date=${logDate}` as never)}>Add programme hours</Button> : null}
      </View> : null}
    </View>
  </View>;
}
