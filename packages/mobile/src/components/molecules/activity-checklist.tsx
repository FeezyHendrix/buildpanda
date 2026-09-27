import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { Activity } from "@/api/activities";
import { Card, Field, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_SUBTLE } from "@/constants/colors";

interface ActivityChecklistProps {
  activities: readonly Activity[];
  selectedIds: readonly string[];
  onToggle: (activityId: string) => void;
  isLoading?: boolean;
}

/**
 * Multi-select of programme activities, mirroring the web's look-ahead
 * dialog: a count in the label, a search box, one checkbox row per activity.
 * Rows are 44px so a gloved thumb can toggle them.
 */
function ActivityChecklistInner({ activities, selectedIds, onToggle, isLoading = false }: ActivityChecklistProps) {
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((activity) => activity.name.toLowerCase().includes(term));
  }, [activities, filter]);

  return (
    <View className="gap-2">
      <Text weight="semibold" className="text-[13px]">
        Activities ({selected.size} selected)
      </Text>

      {isLoading && activities.length === 0 ? (
        <View className="items-center py-6">
          <Spinner size="md" />
        </View>
      ) : activities.length === 0 ? (
        <View className="rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            No activities on the project chart yet. Ask your project manager to add one.
          </Text>
        </View>
      ) : (
        <>
          <Field
            label="Search"
            value={filter}
            onChangeText={setFilter}
            placeholder="Search activities…"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {visible.length === 0 ? (
            <View className="rounded-xl bg-surface-alt px-4 py-3">
              <Text tone="secondary" className="text-[13px]">
                No activity matches that search.
              </Text>
            </View>
          ) : (
            <Card>
              {visible.map((activity) => {
                const checked = selected.has(activity.id);
                return (
                  <Pressable
                    key={activity.id}
                    onPress={() => onToggle(activity.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    className="min-h-14 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
                  >
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={22}
                      color={checked ? ICON_BRAND : ICON_SUBTLE}
                    />
                    <View className="min-w-0 flex-1">
                      <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
                        {activity.name}
                      </Text>
                      {activity.phaseName || activity.location ? (
                        <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
                          {[activity.phaseName, activity.location].filter(Boolean).join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

export const ActivityChecklist = memo(ActivityChecklistInner);
