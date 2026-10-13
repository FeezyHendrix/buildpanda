import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Spinner, Text } from "@/components/atoms";
import { QUICK_TOOL_SLOTS } from "@/components/home/quick-tools-bar";
import { Page } from "@/components/molecules/page";
import { ICON_BRAND, ICON_FAINT, ICON_MUTED } from "@/constants/colors";
import type { Db } from "@/db/client";
import { homeToolsRepository } from "@/db/home-tools-repository";
import { useLocalDb } from "@/db/provider";
import { useAllowedTools, useHomeToolOrder } from "@/hooks/use-home-tools";
import type { HomeToolKey } from "@/lib/home-tools";
import { goBack } from "@/lib/navigation";

// Arranging Home is the user's call: a layout they save here always beats the
// order the app learns from use, until they reset it.

function IconButton({ icon, label, onPress, disabled = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} className="h-11 w-11 items-center justify-center rounded-lg active:bg-surface-alt">
      <Ionicons name={icon} size={20} color={disabled ? ICON_FAINT : ICON_MUTED} />
    </Pressable>
  );
}

function Editor({ db }: { db: Db }) {
  const allowed = useAllowedTools();
  const current = useHomeToolOrder(db);
  const [order, setOrder] = useState<HomeToolKey[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // start from what Home shows now, with hidden tools at the end
  useEffect(() => {
    if (order || current.isPending) return;
    const shown = current.tools.map((tool) => tool.key);
    setOrder([...shown, ...allowed.map((tool) => tool.key).filter((key) => !shown.includes(key))]);
    setHidden(new Set(current.hiddenKeys));
  }, [order, current.isPending, current.tools, current.hiddenKeys, allowed]);

  if (!order) return <Page title="Customise Home" onBack={() => goBack()}><View className="items-center py-12"><Spinner size="md" /></View></Page>;
  const byKey = new Map(allowed.map((tool) => [tool.key, tool]));

  function move(index: number, by: -1 | 1) {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      return next;
    });
  }

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save(reset: boolean) {
    if (!order) return;
    setSaving(true);
    try {
      if (reset) await homeToolsRepository.resetLayout(db);
      else await homeToolsRepository.saveLayout(db, order, hidden);
      goBack();
    } finally {
      setSaving(false);
    }
  }

  let shownIndex = 0;
  return (
    <Page title="Customise Home" onBack={() => goBack()} footer={<Button onPress={() => void save(false)} loading={saving}>Save layout</Button>}>
    <View className="gap-4">
      <Text tone="secondary" className="text-[13px]">
        The first {QUICK_TOOL_SLOTS} shown tools go in the quick bar; the rest of the order sets which cards come first. Without a saved layout, Home learns from what you open most.
      </Text>
      <Card>
        {order.map((key, index) => {
          const tool = byKey.get(key);
          if (!tool) return null;
          const isHidden = hidden.has(key);
          const quick = !isHidden && shownIndex++ < QUICK_TOOL_SLOTS;
          return (
            <View key={key} className={`min-h-16 flex-row items-center gap-2 px-3 py-2 ${index ? "border-t border-hairline" : ""}`}>
              <Ionicons name={tool.icon} size={20} color={isHidden ? ICON_FAINT : ICON_BRAND} />
              <View className="min-w-0 flex-1">
                <Text weight="semibold" tone={isHidden ? "muted" : undefined} className="text-[15px]">{tool.label}</Text>
                <Text tone="secondary" className="text-xs">{isHidden ? "Hidden from Home" : quick ? "Quick bar" : "Card on Home"}</Text>
              </View>
              <IconButton icon="arrow-up" label={`Move ${tool.label} up`} disabled={index === 0} onPress={() => move(index, -1)} />
              <IconButton icon="arrow-down" label={`Move ${tool.label} down`} disabled={index === order.length - 1} onPress={() => move(index, 1)} />
              <IconButton icon={isHidden ? "eye-off-outline" : "eye-outline"} label={isHidden ? `Show ${tool.label}` : `Hide ${tool.label}`} onPress={() => toggle(key)} />
            </View>
          );
        })}
      </Card>
      <Button variant="secondary" onPress={() => void save(true)} disabled={saving}>Reset to automatic</Button>
    </View>
    </Page>
  );
}

export default function CustomiseHome() {
  const { db, ready } = useLocalDb();
  if (!ready || !db) {
    return <Page title="Customise Home" onBack={() => goBack()}><View className="items-center py-12"><Spinner size="md" /></View></Page>;
  }
  return <Editor db={db} />;
}
