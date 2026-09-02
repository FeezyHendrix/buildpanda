import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { materialsRepository, toMaterialOrder } from "@/db/materials-repository";
import { useLocalDb } from "@/db/provider";
import { useUpdateMaterialOrder } from "@/hooks/use-local-materials";
import { useFieldSession } from "@/lib/field-session";

function Editor({ db, projectId, orderId }: { db: Db; projectId: string; orderId: string }) {
  const query = useMemo(() => materialsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const existing = useMemo(
    () => (live.data ?? []).map(toMaterialOrder).find((row) => row.id === orderId),
    [live.data, orderId],
  );

  const update = useUpdateMaterialOrder(db, projectId);
  const [title, setTitle] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!existing) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  // Null means untouched, so a background refresh cannot be overwritten by a
  // stale render — only what the crew member actually typed is sent.
  const titleValue = title ?? existing.title;
  const materialValue = materialName ?? existing.materialName;
  const quantityValue = quantity ?? String(existing.quantity ?? "");
  const unitValue = unit ?? existing.unit;
  const supplierValue = supplier ?? (existing.supplier ?? "");

  async function submit() {
    if (saving || titleValue.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await update(orderId, {
        title: titleValue.trim(),
        materialName: materialValue.trim(),
        quantity: Number.parseFloat(quantityValue) || 0,
        unit: unitValue.trim(),
        supplier: supplierValue.trim() || null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this order.");
    }
  }

  return (
    <View className="gap-5">
      {error ? <Text tone="danger" className="text-[13px]">{error}</Text> : null}
      <Field label="Title" value={titleValue} onChangeText={setTitle} />
      <Field label="Material" value={materialValue} onChangeText={setMaterialName} />
      <View className="flex-row gap-3">
        <Field label="Quantity" value={quantityValue} onChangeText={setQuantity} keyboardType="numeric" className="flex-1" />
        <Field label="Unit" value={unitValue} onChangeText={setUnit} className="flex-1" />
      </View>
      <Field label="Supplier" value={supplierValue} onChangeText={setSupplier} />
      <Button onPress={submit} loading={saving} disabled={titleValue.trim().length === 0}>
        Save changes
      </Button>
    </View>
  );
}

export default function EditMaterialOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Edit order" onBack={() => router.back()}>
      {ready && db && projectId && id ? (
        <Editor db={db} projectId={projectId} orderId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
