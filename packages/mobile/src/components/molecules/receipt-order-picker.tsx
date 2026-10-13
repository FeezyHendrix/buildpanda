import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { FieldLabel, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { sameMaterial } from "@/lib/material-match";

export interface ReceivableOrder {
  id: string;
  title: string;
  materialName: string;
  unit: string;
  outstandingQuantity: number;
}

/** Orders that can take goods: approved and not closed, and known to the server. */
export function isReceivable(order: { id: string; status: string }): boolean {
  return !order.id.startsWith("local_") && ["Approved", "Ordered", "PartiallyDelivered"].includes(order.status);
}

function Choice({ selected, title, detail, onPress }: { selected: boolean; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-2.5 ${selected ? "border-primary-500 bg-primary-50" : "border-hairline bg-white"}`}
    >
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? ICON_BRAND : ICON_MUTED} />
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-[14px]" numberOfLines={1}>{title}</Text>
        <Text tone="secondary" className="text-xs" numberOfLines={1}>{detail}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Which order a delivery is for. The orders for the material being logged
 * come first; picking one makes the receipt that order's material, so stock
 * and the order stay in step. "No order" logs an unplanned delivery.
 */
export function ReceiptOrderPicker({
  orders,
  materialName,
  value,
  onChange,
}: {
  orders: ReceivableOrder[];
  materialName: string;
  value: string | null;
  onChange: (order: ReceivableOrder | null) => void;
}) {
  if (orders.length === 0) return null;
  const typed = materialName.trim();
  const ranked = typed
    ? [...orders].sort((a, b) => Number(sameMaterial(b.materialName, typed)) - Number(sameMaterial(a.materialName, typed)))
    : orders;
  const shown = ranked.slice(0, 5);

  return (
    <View className="gap-2">
      <FieldLabel>Which order is this for?</FieldLabel>
      {shown.map((order) => (
        <Choice
          key={order.id}
          selected={value === order.id}
          title={order.title}
          detail={`${order.materialName} · ${order.outstandingQuantity} ${order.unit} still to come`}
          onPress={() => onChange(order)}
        />
      ))}
      <Choice
        selected={value === null}
        title="No order"
        detail="An unplanned delivery — the office will see it flagged"
        onPress={() => onChange(null)}
      />
    </View>
  );
}

ReceiptOrderPicker.displayName = "ReceiptOrderPicker";
