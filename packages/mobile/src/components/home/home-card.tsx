import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Card, Text } from "@/components/atoms";

/** One Home card: a heading, a line of context and a round arrow into the tool. */
export function HomeCard({ title, subtitle, href, children }: { title: string; subtitle?: string; href: string; children?: ReactNode }) {
  return (
    <Card className="p-4">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text variant="heading" weight="semibold" className="text-lg">{title}</Text>
          {subtitle ? <Text tone="secondary" className="pt-0.5 text-[13px]">{subtitle}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={() => router.push(href as never)} className="h-11 w-11 items-center justify-center rounded-full bg-primary-500">
          <Ionicons name="arrow-forward" size={20} color="white" />
        </Pressable>
      </View>
      {children ? <View className="pt-3">{children}</View> : null}
    </Card>
  );
}

/** A tappable line inside a card. */
export function CardRow({ title, meta, onPress, trailing }: { title: string; meta?: string; onPress?: () => void; trailing?: ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} className="min-h-12 flex-row items-center gap-3 border-t border-hairline py-2.5 active:bg-surface-alt">
      <View className="min-w-0 flex-1">
        <Text weight="medium" className="text-sm" numberOfLines={1}>{title}</Text>
        {meta ? <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>{meta}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

export function CardEmpty({ children }: { children: string }) {
  return <Text tone="secondary" className="border-t border-hairline pt-3 text-[13px]">{children}</Text>;
}
