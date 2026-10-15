import { withProjectPermission } from "@/components/molecules/permission-gate";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Spinner, Text } from "@/components/atoms";
import { QUICK_TOOL_SLOTS } from "@/components/home/quick-tools-bar";
import { Page } from "@/components/molecules/page";
import { SortableList } from "@/components/molecules/sortable-list";
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
  const [error, setError] = useState<string | null>(null);

  // start from what Home shows now, with hidden tools at the end
  useEffect(() => {
    if (order || current.isPending) return;
    const shown = current.tools.map((tool) => tool.key);
    setOrder([...shown, ...allowed.map((tool) => tool.key).filter((key) => !shown.includes(key))]);
    setHidden(new Set(current.hiddenKeys));
  }, [order, current.isPending, current.tools, current.hiddenKeys, allowed]);

  if (!order) return <Page title="Customise Home" onBack={() => goBack()}><View className="items-center py-12"><Spinner size="md" /></View></Page>;
  const byKey = new Map(allowed.map((tool) => [tool.key, tool]));
  const tools = order.flatMap((key) => byKey.get(key) ?? []);
  const quickKeys = new Set(tools.filter((tool) => !hidden.has(tool.key)).slice(0, QUICK_TOOL_SLOTS).map((tool) => tool.key));

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
    setError(null);
    try {
      if (reset) await homeToolsRepository.resetLayout(db);
      else await homeToolsRepository.saveLayout(db, order, hidden);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your layout. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page scroll={false} title="Customise Home" onBack={() => goBack()} footer={<Button onPress={() => void save(false)} loading={saving}>Save layout</Button>}>
      <SortableList data={tools} rowHeight={76} keyExtractor={(tool) => tool.key} labelExtractor={(tool) => tool.label}
        disabled={saving} onReorder={(next) => setOrder(next.map((tool) => tool.key))}
        header={<View className="gap-3 pb-4">
          <Text tone="secondary" className="text-[13px]">
            Drag a handle to rearrange your tools. The first {QUICK_TOOL_SLOTS} visible tools appear in the quick bar. Tap the eye to show or hide a tool.
          </Text>
          {error ? <Text tone="danger" className="text-sm">{error}</Text> : null}
        </View>}
        footer={<View className="gap-3 pt-4">
          <Text tone="secondary" className="text-[13px]">Automatic order learns from the tools you open most.</Text>
          <Button variant="secondary" onPress={() => void save(true)} disabled={saving}>Reset to automatic</Button>
        </View>}
        renderItem={({ item: tool, dragHandle }) => {
          const isHidden = hidden.has(tool.key);
          return <View className="flex-1 flex-row items-center gap-2 px-2">
              {dragHandle}
              <Ionicons name={tool.icon} size={20} color={isHidden ? ICON_FAINT : ICON_BRAND} />
              <View className="min-w-0 flex-1">
                <Text weight="semibold" tone={isHidden ? "muted" : undefined} className="text-[15px]" numberOfLines={1}>{tool.label}</Text>
                <Text tone="secondary" className="text-xs">{isHidden ? "Hidden from Home" : quickKeys.has(tool.key) ? "Quick bar" : "Card on Home"}</Text>
              </View>
              <IconButton icon={isHidden ? "eye-off-outline" : "eye-outline"} label={isHidden ? `Show ${tool.label}` : `Hide ${tool.label}`} disabled={saving} onPress={() => toggle(tool.key)} />
            </View>;
        }} />
    </Page>
  );
}

function CustomiseHome() {
  const { db, ready } = useLocalDb();
  if (!ready || !db) {
    return <Page title="Customise Home" onBack={() => goBack()}><View className="items-center py-12"><Spinner size="md" /></View></Page>;
  }
  return <Editor db={db} />;
}

export default withProjectPermission(CustomiseHome, "/tools/customise-home");
