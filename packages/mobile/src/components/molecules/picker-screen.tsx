import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, SectionList, TextInput, View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { useDebounce } from "@/hooks/use-debounce";
import { Page } from "./page";
import { cn } from "@/lib/utils";

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
  status?: string;
}

interface PickerScreenProps {
  title: string;
  description: string;
  items: readonly PickerItem[];
  activeId?: string;
  loading?: boolean;
  busyId?: string;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage?: string;
  searchPlaceholder?: string;
  /** Label for the group holding everything that isn't the current selection. */
  otherLabel?: string;
  onBack?: () => void;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <View className="mb-4 h-11 flex-row items-center gap-2 rounded-xl bg-surface-alt px-3">
      <Ionicons name="search" size={18} color="#888888" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#ADADAD"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="h-11 flex-1 font-jakarta text-base text-black-500"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color="#ADADAD" />
        </Pressable>
      ) : null}
    </View>
  );
}

function GroupHeader({ text }: { text: string }) {
  return (
    <Text weight="semibold" tone="muted" className="px-1 pb-2 pt-4 text-[11px] tracking-wide">
      {text}
    </Text>
  );
}

function PickerRow({
  item,
  isActive,
  isBusy,
  onSelect,
}: {
  item: PickerItem;
  isActive: boolean;
  isBusy: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive, busy: isBusy }}
      className={cn(
        "min-h-16 flex-row items-center gap-3 rounded-2xl border px-4 py-3",
        isActive
          ? "border-primary-200 bg-primary-50"
          : "border-hairline bg-surface active:bg-surface-alt",
      )}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-500">
        <Text weight="bold" tone="inverse" className="text-xs">
          {item.label.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-base" numberOfLines={1}>
          {item.label}
        </Text>
        {item.sublabel ? (
          <Text tone="secondary" className="pt-0.5 text-[13px]" numberOfLines={1}>
            {item.sublabel}
          </Text>
        ) : null}
      </View>

      {isBusy ? (
        <Spinner size="sm" />
      ) : isActive ? (
        <Ionicons name="checkmark" size={20} color="#004DE7" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#C8C8C8" />
      )}
    </Pressable>
  );
}

export function PickerScreen({
  title,
  description,
  items,
  activeId,
  loading = false,
  busyId,
  emptyTitle,
  emptyDescription,
  errorMessage,
  searchPlaceholder = "Search",
  otherLabel = "OTHER PROJECTS",
  onBack,
  onSelect,
  footer,
}: PickerScreenProps) {
  const [term, setTerm] = useState("");
  const query = useDebounce(term).trim().toLowerCase();

  // Selected first, everything else under a group header — the arrangement the
  // iOS app uses so the current project is always the top row.
  const sections = useMemo(() => {
    const matches = query
      ? items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            (item.sublabel ?? "").toLowerCase().includes(query),
        )
      : items;

    const selected = matches.filter((item) => item.id === activeId);
    const others = matches.filter((item) => item.id !== activeId);

    const grouped: { title: string; data: PickerItem[] }[] = [];
    if (selected.length) grouped.push({ title: "SELECTED", data: selected });
    if (others.length) grouped.push({ title: otherLabel, data: others });
    return grouped;
  }, [items, activeId, query, otherLabel]);

  const showSearch = !loading && items.length > 0;

  return (
    <Page variant="left" title={title} description={description} onBack={onBack} scroll={false} footer={footer}>
      {errorMessage ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {showSearch ? (
        <SearchField value={term} onChange={setTerm} placeholder={searchPlaceholder} />
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner size="lg" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => <GroupHeader text={section.title} />}
          renderItem={({ item }) => (
            <PickerRow
              item={item}
              isActive={item.id === activeId}
              isBusy={item.id === busyId}
              onSelect={onSelect}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerClassName="pb-6 w-full max-w-[640px] self-center"
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Text weight="semibold" className="text-center text-base">
                {query ? "No matches" : emptyTitle}
              </Text>
              <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
                {query ? `Nothing matches “${term.trim()}”.` : emptyDescription}
              </Text>
            </View>
          }
        />
      )}
    </Page>
  );
}

PickerScreen.displayName = "PickerScreen";
