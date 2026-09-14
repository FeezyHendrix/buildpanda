import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialOrder, useUpdateMaterialOrder } from "@/hooks/use-local-materials";
import { isIsoDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

const TITLE = "Edit material order";

function Editor({ db, projectId, orderId }: { db: Db; projectId: string; orderId: string }) {
  const { data: existing } = useLocalMaterialOrder(db, orderId);

  const update = useUpdateMaterialOrder(db, projectId);
  const { isOnline } = useSyncState();
  const [title, setTitle] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Null means untouched, so a background refresh cannot be overwritten by a
  // stale render — only what the crew member actually typed is sent.
  const titleValue = title ?? existing?.title ?? "";
  const materialValue = materialName ?? existing?.materialName ?? "";
  const quantityValue = quantity ?? String(existing?.quantity ?? "");
  const unitValue = unit ?? existing?.unit ?? "";
  const supplierValue = supplier ?? existing?.supplier ?? "";
  const neededByValue = neededBy ?? existing?.neededBy ?? "";

  // Same rules as the new-order form: the API rejects a missing quantity or
  // needed-by date, so an edit that would strip them is refused here.
  const quantityNumber = Number.parseFloat(quantityValue);
  const isQuantityValid = Number.isFinite(quantityNumber) && quantityNumber > 0;
  const isNeededByValid = isIsoDate(neededByValue.trim());
  const canSubmit =
    Boolean(existing) &&
    titleValue.trim().length > 0 &&
    materialValue.trim().length > 0 &&
    unitValue.trim().length > 0 &&
    isQuantityValid &&
    isNeededByValid &&
    !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await update(orderId, {
        title: titleValue.trim(),
        materialName: materialValue.trim(),
        quantity: quantityNumber,
        unit: unitValue.trim(),
        neededBy: neededByValue.trim(),
        supplier: supplierValue.trim() || null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this order.");
    }
  }

  return (
    <Page
      title={TITLE}
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

      {!existing ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <View className="gap-5">
          <Field label="Title" value={titleValue} onChangeText={setTitle} placeholder="What is this for?" />
          <Field label="Material" value={materialValue} onChangeText={setMaterialName} placeholder="e.g. Cement" />
          <View className="flex-row gap-3">
            <Field label="Quantity" value={quantityValue} onChangeText={setQuantity} keyboardType="numeric" className="flex-1" />
            <Field label="Unit" value={unitValue} onChangeText={setUnit} placeholder="bags" className="flex-1" />
          </View>
          <Field label="Supplier" value={supplierValue} onChangeText={setSupplier} placeholder="Optional" />
          <Field
            label="Needed by"
            value={neededByValue}
            onChangeText={setNeededBy}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            error={neededByValue.length > 0 && !isNeededByValid ? "Enter a date as YYYY-MM-DD." : undefined}
          />
        </View>
      )}
    </Page>
  );
}

export default function EditMaterialOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!ready || !db || !projectId || !id) {
    return (
      <Page title={TITLE} onBack={() => router.back()}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }

  return <Editor db={db} projectId={projectId} orderId={id} />;
}
