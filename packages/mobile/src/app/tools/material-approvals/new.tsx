import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { MATERIAL_UNITS, type MaterialUnit } from "@/api/material-approvals";
import type { CommentAssignee } from "@/api/participants";
import { Button, Field, OptionRow, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useLocalDb } from "@/db/provider";
import { useCreateMaterialApproval } from "@/hooks/use-material-approvals";
import { useProjectAssignees } from "@/hooks/use-participants";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";

const ANYONE = "anyone";

function ReviewerPicker({
  assignees,
  value,
  onChange,
}: {
  assignees: readonly CommentAssignee[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text weight="semibold" className="text-[13px]">
        Request approval from
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {[{ id: ANYONE, name: "Anyone who can approve" }, ...assignees].map((person) => {
          const isActive = person.id === value;
          return (
            <Pressable
              key={person.id}
              onPress={() => onChange(person.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              className={cn(
                "min-h-11 justify-center rounded-xl px-4",
                isActive ? "bg-primary-500" : "bg-surface-alt",
              )}
            >
              <Text
                weight="semibold"
                tone={isActive ? "inverse" : "secondary"}
                className="text-[13px]"
              >
                {person.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NewMaterialApproval() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const { isOnline } = useSyncState();
  const assignees = useProjectAssignees(projectId);
  const createApproval = useCreateMaterialApproval(db, projectId);

  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [specification, setSpecification] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<MaterialUnit>("ea");
  const [supplier, setSupplier] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [reviewerId, setReviewerId] = useState<string>(ANYONE);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQuantity = Number(quantity.trim());
  const isQuantityValid =
    quantity.trim().length === 0 || (Number.isFinite(parsedQuantity) && parsedQuantity >= 0);
  const canSubmit =
    title.trim().length > 0 && materialName.trim().length > 0 && isQuantityValid && !saving;

  async function handleSubmit() {
    if (!canSubmit || !projectId) return;
    setError(null);
    setSaving(true);
    try {
      // Writes to SQLite and queues the push; it does not wait on the network,
      // so this succeeds with no signal.
      await createApproval({
        title: title.trim(),
        materialName: materialName.trim(),
        specification: specification.trim() || null,
        quantity: quantity.trim().length > 0 ? parsedQuantity : 0,
        unit,
        supplier: supplier.trim() || null,
        neededBy: neededBy.trim() || null,
        description: description.trim() || null,
        requestedReviewerId: reviewerId === ANYONE ? null : reviewerId,
        requestedReviewerName:
          assignees.find((person) => person.id === reviewerId)?.name ?? null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this request.");
    }
  }

  return (
    <Page
      title="New Approval Request"
      onBack={() => router.back()}
      footer={
        <Button onPress={handleSubmit} disabled={!canSubmit} loading={saving}>
          Send request
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
            You&apos;re offline. This request is saved on your device and is sent for approval when
            you get signal.
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <Field
          label="Request title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Block A external cladding approval"
          autoFocus
        />
        <Field
          label="Material"
          value={materialName}
          onChangeText={setMaterialName}
          placeholder="e.g. Fibre cement cladding board"
        />
        <Field
          label="Specification"
          value={specification}
          onChangeText={setSpecification}
          placeholder="Grade, finish, standard, manufacturer reference…"
          multiline
          className="min-h-20"
        />
        <View className="flex-row gap-3">
          <Field
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1"
            keyboardType="decimal-pad"
            error={isQuantityValid ? undefined : "Enter a number of zero or more."}
            className="flex-1"
          />
          <Field
            label="Needed by"
            value={neededBy}
            onChangeText={setNeededBy}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            className="flex-1"
          />
        </View>
        <OptionRow label="Unit" options={MATERIAL_UNITS} value={unit} onChange={setUnit} />
        <Field
          label="Supplier"
          value={supplier}
          onChangeText={setSupplier}
          placeholder="Proposed supplier"
        />
        <ReviewerPicker assignees={assignees} value={reviewerId} onChange={setReviewerId} />
        <Field
          label="Notes"
          value={description}
          onChangeText={setDescription}
          placeholder="Why this material, substitution reasoning, lead-time constraints…"
          multiline
          className="min-h-20"
        />
      </View>
    </Page>
  );
}
