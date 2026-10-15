import { StageField } from "@/components/molecules/stage-field";
import { useStageScope } from "@/lib/stage-scope";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";

import { useState } from "react";
import { View } from "react-native";
import type { UpdateCategory } from "@/api/updates";
import { Button, Field, OptionRow, Text } from "@/components/atoms";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { FieldLabel } from "@/components/atoms/input";
import { htmlToText } from "@/lib/html";
import { Page } from "@/components/molecules/page";
import {
  UpdateMediaPicker,
  type PickedUpdateMedia,
} from "@/components/molecules/update-media-picker";
import { useLocalDb } from "@/db/provider";
import { useCreateProjectUpdate } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";
import { readCachedUser } from "@/lib/session-cache";
import { useSyncState } from "@/lib/sync-provider";

const CATEGORIES: readonly UpdateCategory[] = [
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
];

// The create endpoint's own limits, so an update written offline cannot be
// rejected hours later for a length the crew member was never shown.
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

function NewProjectUpdate() {
  const { projectId } = useFieldSession();
  const scope = useStageScope();
  const { db, ready } = useLocalDb();
  const { isOnline } = useSyncState();
  const createUpdate = useCreateProjectUpdate(db, projectId);

  const [stageId, setStageId] = useState<string | null>(scope.stageId ?? null);
  const [category, setCategory] = useState<UpdateCategory | "">("");
  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const description = htmlToText(descriptionHtml);
  const [media, setMedia] = useState<PickedUpdateMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    Boolean(projectId && db && ready) &&
    category !== "" &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    description.length <= DESCRIPTION_MAX && descriptionHtml.length <= 200000 &&
    !saving;

  async function handleSubmit() {
    if (category === "" || !canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      // Writes to SQLite and queues the push; it does not wait on the network,
      // so this succeeds with no signal and the photos go up later.
      await createUpdate({
        category,
        title: title.trim(),
        description: description.trim(),
        descriptionHtml,
        stageId,
        authorName: readCachedUser()?.name ?? null,
        media,
      });
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this update.");
    }
  }

  return (
    <Page
      title="New update"
      onBack={() => goBack()}
      footer={
        <Button onPress={handleSubmit} disabled={!canSubmit} loading={saving}>
          {isOnline ? "Post update" : "Queue update"}
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
            You&apos;re offline. This update and its photos are saved on your device and are posted
            when you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <StageField value={stageId} onChange={setStageId} />
        <OptionRow<UpdateCategory | "">
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Reinforcements delivered on site"
          maxLength={TITLE_MAX}
          autoFocus
        />
        <View className="gap-2"><FieldLabel>Details</FieldLabel>
          <RichTextEditor label="Details" value={descriptionHtml} onChange={setDescriptionHtml}
            projectId={projectId} placeholder="Describe what happened on site." />
          {description.length > DESCRIPTION_MAX ? <Text tone="danger">Keep details within 2,000 characters.</Text> : null}
        </View>
        <UpdateMediaPicker media={media} onChange={setMedia} onError={setError} />
      </View>
    </Page>
  );
}

export default withProjectPermission(NewProjectUpdate, "/tools/updates/new");
