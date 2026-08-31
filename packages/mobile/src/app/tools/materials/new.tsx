import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useLocalDb } from "@/db/provider";
import { useCreateMaterialOrder } from "@/hooks/use-local-materials";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

export default function NewMaterialOrder() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const create = useCreateMaterialOrder(db, projectId);
  const { isOnline } = useSyncState();

  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 && materialName.trim().length > 0 && unit.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        title: title.trim(),
        materialName: materialName.trim(),
        quantity: Number.parseFloat(quantity) || 0,
        unit: unit.trim(),
        supplier: supplier.trim() || null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this order.");
    }
  }

  return (
    <Page
      title="New material order"
      onBack={() => router.back()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Raise order
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
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="What is this for?" autoFocus />
        <Field label="Material" value={materialName} onChangeText={setMaterialName} placeholder="e.g. Cement" />
        <View className="flex-row gap-3">
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" className="flex-1" />
          <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="bags" className="flex-1" />
        </View>
        <Field label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="Optional" />
      </View>
    </Page>
  );
}
