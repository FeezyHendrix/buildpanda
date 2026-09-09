import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";

export function ScheduleListScreen({
  title,
  isPending,
  isStale,
  isEmpty,
  emptyTitle,
  emptyBody,
  children,
}: {
  title: string;
  isPending: boolean;
  isStale: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  return (
    <Page title={title} onBack={() => router.back()}>
      {isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : isEmpty ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            {emptyTitle}
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            {emptyBody}
          </Text>
        </View>
      ) : (
        <>
          {isStale ? (
            <Text tone="muted" className="pb-2 text-xs">
              Showing your last synced data — you&apos;re offline.
            </Text>
          ) : null}
          <Card>{children}</Card>
        </>
      )}
    </Page>
  );
}
