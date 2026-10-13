import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Text, type TextTone } from "@/components/atoms";

export interface Stat {
  key: string;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: TextTone;
}

/** Numbers that need attention today, each opening the tool behind it. */
export function StatCards({ stats }: { stats: readonly Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-3">
      {stats.map((stat) => (
        <Pressable key={stat.key} accessibilityRole="button" accessibilityLabel={`${stat.label}: ${stat.value}, ${stat.detail}`} onPress={() => router.push(stat.href as never)} className="min-w-[40%] flex-1 basis-[45%]">
          <Card className="min-h-24 p-4">
            <Text tone="secondary" weight="semibold" className="text-xs">{stat.label}</Text>
            <Text variant="heading" weight="bold" tone={stat.tone} className="pt-1 text-3xl">{stat.value}</Text>
            <Text tone="secondary" className="text-xs" numberOfLines={1}>{stat.detail}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
