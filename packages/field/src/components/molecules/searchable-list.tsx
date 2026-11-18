import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { FlatList } from "@/platform/browser";
import { useSafeAreaInsets } from "@/platform/safe-area";
import { Spinner, Text } from "@/components/atoms";
import { matchesSearch } from "@/lib/search";
import { SearchField } from "./search-field";
export function SearchableList<T extends {
    id: string;
}>({ data, fields, renderItem, placeholder, emptyTitle, emptyBody, loading, header, cards = false, }: {
    data: readonly T[];
    fields: (item: T) => readonly (string | number | null | undefined)[];
    renderItem: (item: T) => ReactElement;
    placeholder: string;
    emptyTitle: string;
    emptyBody?: string;
    loading?: boolean;
    header?: ReactNode;
    cards?: boolean;
}) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState("");
    const rows = useMemo(() => data.filter((item) => matchesSearch(query, fields(item))), [data, fields, query]);
    return (<div className="field-stack min-h-0 flex-1">
      <SearchField value={query} onChange={setQuery} placeholder={placeholder}/>
      <FlatList style={{ flex: 1, minHeight: 0 }} data={rows} keyExtractor={(item) => item.id} renderItem={({ item }) => (<div className={"field-stack " + (cards ? "mb-3" : "bg-surface")}>{renderItem(item)}</div>)} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} ListHeaderComponent={<>{header}</>} ListEmptyComponent={loading ? (<div className="field-stack py-12">
              <Spinner size="md"/>
            </div>) : (<div className="field-stack items-center py-12">
              <Text weight="semibold" className="text-center text-base">
                {query.trim() ? "No matches" : emptyTitle}
              </Text>
              <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
                {query.trim()
                ? `Nothing matches “${query.trim()}”. Try another search.`
                : emptyBody}
              </Text>
            </div>)}/>
    </div>);
}
