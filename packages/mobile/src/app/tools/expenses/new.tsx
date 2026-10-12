import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Field, FieldLabel, OptionRow, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { StageField } from "@/components/molecules/stage-field";
import { ICON_BRAND } from "@/constants/colors";
import { useLocalDb } from "@/db/provider";
import { useExpenseCategories, useLogExpense } from "@/hooks/use-expenses";
import { useSession } from "@/lib/auth-client";
import { isIsoDate, localIsoDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { useStageScope } from "@/lib/stage-scope";
import { useSyncState } from "@/lib/sync-provider";

type Receipt = { uri: string; fileName: string; mimeType: string };
type Kind = "expense" | "credit";
const KINDS = [
  { value: "expense", label: "Money spent" },
  { value: "credit", label: "Refund or credit" },
] as const;

// Logging an expense records money spent off the platform; nothing is paid
// from here. The receipt photo is kept on the phone until there is signal.

async function pickReceipt(source: "camera" | "library"): Promise<Receipt | null> {
  const permission = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === "camera" ? "Camera access is off. Enable it in Settings to photograph receipts." : "Photo library access is off. Enable it in Settings to attach a receipt.");
  }
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri, fileName: asset.fileName ?? "receipt.jpg", mimeType: asset.mimeType ?? "image/jpeg" } : null;
}

export default function NewExpense() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const logExpense = useLogExpense(db, projectId);
  const categories = useExpenseCategories(projectId);
  const { data: session } = useSession();
  const { isOnline } = useSyncState();
  const scope = useStageScope();

  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("materials");
  const [date, setDate] = useState(localIsoDate());
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<string | null>(scope.stageId ?? null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount.trim().replace(/,/g, ""));
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;
  const chosen = categories.find((c) => c.key === category) ?? categories[0];
  const canSubmit = amountValid && title.trim().length > 0 && isIsoDate(date.trim()) && Boolean(chosen) && !saving;

  async function attach(source: "camera" | "library") {
    setError(null);
    try {
      const picked = await pickReceipt(source);
      if (picked) setReceipt(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach the receipt.");
    }
  }

  async function submit() {
    if (!canSubmit || !chosen) return;
    setSaving(true);
    setError(null);
    try {
      await logExpense({
        title: title.trim(),
        category: chosen.key,
        categoryLabel: chosen.label,
        amount: amountValue,
        transactedAt: date.trim(),
        vendor: vendor.trim() || null,
        description: description.trim() || null,
        stageId,
        credit: kind === "credit",
        receipt,
        createdByName: session?.user.name ?? "You",
      });
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not log this expense.");
    }
  }

  return (
    <Page title="Log expense" onBack={() => goBack()} footer={<Button onPress={submit} disabled={!canSubmit} loading={saving}>Log expense</Button>}>
      <View className="gap-5">
        {error ? (
          <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
        ) : null}
        {!isOnline ? (
          <View className="rounded-xl bg-surface-alt px-4 py-3">
            <Text tone="secondary" className="text-[13px]">You&apos;re offline. This and its receipt are saved on your device and upload when you get signal.</Text>
          </View>
        ) : null}
        <OptionRow label="Type" options={KINDS} value={kind} onChange={setKind} />
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" autoFocus />
        <Field label="What for" value={title} onChangeText={setTitle} placeholder="e.g. Diesel for the generator" />
        <OptionRow label="Category" options={categories.map((c) => ({ value: c.key, label: c.label }))} value={chosen?.key ?? category} onChange={setCategory} />
        <View className="gap-2">
          <FieldLabel>Receipt</FieldLabel>
          {receipt ? (
            <View className="flex-row items-center gap-3">
              <Image source={{ uri: receipt.uri }} style={{ width: 72, height: 96, borderRadius: 8 }} contentFit="cover" accessibilityLabel="Receipt photo" />
              <Button variant="secondary" onPress={() => setReceipt(null)}>Remove</Button>
            </View>
          ) : (
            <View className="flex-row gap-2">
              {(["camera", "library"] as const).map((source) => (
                <Pressable key={source} accessibilityRole="button" onPress={() => void attach(source)} className="min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3">
                  <Ionicons name={source === "camera" ? "camera-outline" : "images-outline"} size={20} color={ICON_BRAND} />
                  <Text weight="semibold" className="text-sm">{source === "camera" ? "Take photo" : "From library"}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" error={isIsoDate(date.trim()) ? undefined : "Enter a date as YYYY-MM-DD."} />
        <Field label="Supplier" value={vendor} onChangeText={setVendor} placeholder="Optional" />
        <StageField value={stageId} onChange={setStageId} />
        <Field label="Notes" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
      </View>
    </Page>
  );
}
