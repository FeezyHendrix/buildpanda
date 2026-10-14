import { features } from "@/lib/feature-access";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Field, FieldLabel, OptionRow, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ReceiptOrderPicker, isReceivable, type ReceivableOrder } from "@/components/molecules/receipt-order-picker";
import { StageField } from "@/components/molecules/stage-field";
import { useLocalMaterialOrders } from "@/hooks/use-local-materials";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useKnownMaterials, useLogMaterial } from "@/hooks/use-material-log";
import { useProjectAccess } from "@/hooks/use-project-access";
import { useSession } from "@/lib/auth-client";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { useStageScope } from "@/lib/stage-scope";
import { useSyncState } from "@/lib/sync-provider";

type Movement = "IN" | "USED";
const MOVEMENTS = [
  { value: "IN", label: "Received" },
  { value: "USED", label: "Used" },
] as const;

// Logging a movement is authoring a ledger record, so it is a full page. The
// crew logs what arrives; usage is logged by people who manage materials.

function LogForm({ db, projectId }: { db: Db; projectId: string }) {
  const { allows } = useProjectAccess();
  const canLogUsage = allows(features.materialLog.actions.usage);
  const known = useKnownMaterials(db, projectId);
  const logMaterial = useLogMaterial(db, projectId);
  const { data: session } = useSession();
  const { isOnline } = useSyncState();
  const scope = useStageScope();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { data: allOrders } = useLocalMaterialOrders(db, projectId, false);
  const orders = useMemo<ReceivableOrder[]>(() => allOrders.filter(isReceivable), [allOrders]);

  const [entryType, setEntryType] = useState<Movement>("IN");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [stageId, setStageId] = useState<string | null>(scope.stageId ?? null);
  const [notesHtml, setNotesHtml] = useState("");
  const [order, setOrder] = useState<ReceivableOrder | null>(null);
  // Arriving from an order ("Log a delivery" on its page) preselects it once
  // the local orders have loaded, and only once.
  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (preselected || !params.orderId || orders.length === 0) return;
    setPreselected(true);
    const match = orders.find((o) => o.id === params.orderId);
    if (match) pickOrder(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the orders arrive
  }, [orders, params.orderId, preselected]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityValue = Number(quantity.trim().replace(",", "."));
  const valid = materialName.trim().length > 0 && unit.trim().length > 0 && Number.isFinite(quantityValue) && quantityValue > 0;
  const typed = materialName.trim().toLowerCase();
  const suggestions = known
    .filter((m) => m.name.toLowerCase() !== typed && (!typed || m.name.toLowerCase().includes(typed)))
    .slice(0, 6);

  function pickMaterial(name: string) {
    setMaterialName(name);
    const match = known.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    if (match?.unit) setUnit(match.unit);
  }

  /** A receipt against an order is that order's material, so the stock line matches. */
  function pickOrder(next: ReceivableOrder | null) {
    setOrder(next);
    if (!next) return;
    setMaterialName(next.materialName);
    setUnit(next.unit);
    if (!quantity.trim() && next.outstandingQuantity > 0) setQuantity(String(next.outstandingQuantity));
  }

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await logMaterial({
        entryType,
        materialName: materialName.trim(),
        unit: unit.trim(),
        quantity: quantityValue,
        stageId,
        notesHtml: notesHtml.trim() || null,
        loggedByName: session?.user.name ?? "You",
        materialOrderId: entryType === "IN" ? order?.id ?? null : null,
        materialOrderTitle: entryType === "IN" ? order?.title ?? null : null,
      });
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not log this material.");
    }
  }

  return (
    <Page
      title={entryType === "IN" ? "Log a delivery" : "Log material used"}
      onBack={() => goBack()}
      footer={
        <Button onPress={submit} disabled={!valid} loading={saving}>
          {entryType === "IN" ? "Log delivery" : "Log usage"}
        </Button>
      }
    >
      <View className="gap-5">
        {error ? (
          <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
        ) : null}
        {!isOnline ? (
          <View className="rounded-xl bg-surface-alt px-4 py-3">
            <Text tone="secondary" className="text-[13px]">You&apos;re offline. This is saved on your device and uploads when you get signal.</Text>
          </View>
        ) : null}
        {canLogUsage ? <OptionRow label="Movement" options={MOVEMENTS} value={entryType} onChange={setEntryType} /> : null}
        {entryType === "IN" ? (
          <ReceiptOrderPicker orders={orders} materialName={materialName} value={order?.id ?? null} onChange={pickOrder} />
        ) : null}
        <View className="gap-2">
          <Field label="Material" value={materialName} onChangeText={pickMaterial} placeholder="e.g. Cement" autoFocus />
          {suggestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {suggestions.map((m) => (
                <Pressable key={m.name} accessibilityRole="button" onPress={() => pickMaterial(m.name)} className="min-h-11 justify-center rounded-xl bg-surface-alt px-4">
                  <Text weight="semibold" tone="secondary" className="text-[13px]">{m.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <View className="flex-row gap-3">
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" className="flex-1" />
          <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="bags" autoCapitalize="none" className="flex-1" />
        </View>
        <StageField value={stageId} onChange={setStageId} />
        <View className="gap-2">
          <FieldLabel>Notes and photos (optional)</FieldLabel>
          <RichTextEditor value={notesHtml} onChange={setNotesHtml} placeholder="Supplier, delivery ticket, condition, where it's stored" projectId={projectId} />
        </View>
        <Text tone="secondary" className="text-xs">A manager approves each entry before it counts in stock.</Text>
      </View>
    </Page>
  );
}

function NewMaterialLogEntry() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  if (!ready || !db || !projectId) {
    return (
      <Page title="Log a delivery" onBack={() => goBack()}>
        <View className="items-center py-12"><Spinner size="md" /></View>
      </Page>
    );
  }
  return <LogForm key={projectId} db={db} projectId={projectId} />;
}

export default withProjectPermission(NewMaterialLogEntry, "/tools/material-log/new");
