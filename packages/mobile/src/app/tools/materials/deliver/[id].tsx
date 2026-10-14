import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialOrder, useRecordDelivery } from "@/hooks/use-local-materials";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { useSyncState } from "@/lib/sync-provider";

type LocalOrder = NonNullable<ReturnType<typeof useLocalMaterialOrder>["data"]>;

// Signing for goods is a contractual record — it books the stock and the cost
// against the order — so it is authored on a full page, not a tap.

function DeliveryForm({ db, projectId, order }: { db: Db; projectId: string; order: LocalOrder }) {
  const record = useRecordDelivery(db, projectId);
  const { isOnline } = useSyncState();
  const [quantity, setQuantity] = useState(order.outstandingQuantity > 0 ? String(order.outstandingQuantity) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(quantity.trim().replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;
  const over = valid && value > order.outstandingQuantity && order.outstandingQuantity > 0;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await record(order.id, value, note.trim() || null);
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not record this delivery.");
    }
  }

  return (
    <Page
      title="Record a delivery"
      onBack={() => goBack()}
      footer={<Button onPress={submit} disabled={!valid} loading={saving}>Record delivery</Button>}
    >
      <View className="gap-5">
        <View className="gap-1">
          <Text weight="bold" className="text-lg">{order.title || order.materialName}</Text>
          <Text tone="secondary" className="text-[13px]">
            {order.deliveredQuantity} of {order.quantity} {order.unit} delivered so far
          </Text>
        </View>
        {error ? (
          <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
        ) : null}
        {!isOnline ? (
          <View className="rounded-xl bg-surface-alt px-4 py-3">
            <Text tone="secondary" className="text-[13px]">You&apos;re offline. This is saved on your device and uploads when you get signal.</Text>
          </View>
        ) : null}
        <Field
          label={`Quantity received (${order.unit})`}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          autoFocus
          error={over ? `More than the ${order.outstandingQuantity} ${order.unit} still to come. It is recorded as an over-delivery.` : undefined}
        />
        <Field label="Delivery note number (optional)" value={note} onChangeText={setNote} placeholder="e.g. DN-4471" autoCapitalize="characters" />
        <Text tone="secondary" className="text-xs">
          This adds the goods to stock and moves the order to partly or fully delivered.
        </Text>
      </View>
    </Page>
  );
}

function Loaded({ db, projectId, orderId }: { db: Db; projectId: string; orderId: string }) {
  const { data: order } = useLocalMaterialOrder(db, orderId);
  if (!order) {
    return (
      <Page title="Record a delivery" onBack={() => goBack()}>
        <View className="items-center py-12"><Spinner size="md" /></View>
      </Page>
    );
  }
  return <DeliveryForm db={db} projectId={projectId} order={order} />;
}

function RecordDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  if (!ready || !db || !projectId || !id) {
    return (
      <Page title="Record a delivery" onBack={() => goBack()}>
        <View className="items-center py-12"><Spinner size="md" /></View>
      </Page>
    );
  }
  return <Loaded db={db} projectId={projectId} orderId={id} />;
}

export default withProjectPermission(RecordDelivery, "/tools/materials/deliver/[id]");
