import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/atoms";
import { SearchField } from "@/components/molecules/search-field";
import { matchesSearch } from "@/lib/search";

// A sheet is known on site by its drawing number, not its position in a list.
// The document row has no number column, so it is read off the file name when
// it leads with one ("A-104 First Floor Plan.pdf"); otherwise the name itself
// is the identifier.

/** Sheets beyond this many get a search field; a strip of forty chips is not scannable. */
const SEARCHABLE_FROM = 8;

/** A drawing number at the start of a file name: "A-104", "S201", "M-01a". */
const DRAWING_NUMBER = /^([A-Za-z]{1,3}[-_ ]?\d{1,4}[A-Za-z]?)(?:[\s_\-–—.]+(.*))?$/;

export interface SheetSource {
  id: string;
  fileName: string;
}

export interface SheetLabel {
  /** What leads an RFI or approval raised from the sheet, as `sheet.code` does on the web. */
  code: string;
  title: string;
}

export function sheetLabel(sheet: Pick<SheetSource, "fileName">): SheetLabel {
  const base = sheet.fileName.replace(/\.[A-Za-z0-9]+$/, "").trim();
  const match = DRAWING_NUMBER.exec(base);
  if (match) {
    const code = match[1].toUpperCase().replace(/[_ ]/, "-");
    return { code, title: match[2]?.trim() || "" };
  }
  return { code: base || sheet.fileName, title: "" };
}

export function SheetStrip({
  sheets,
  activeId,
  onSelect,
}: {
  sheets: SheetSource[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const labelled = useMemo(() => sheets.map((sheet) => ({ sheet, label: sheetLabel(sheet) })), [sheets]);
  const shown = useMemo(() => labelled.filter(({ label }) => matchesSearch(search, [label.code, label.title])), [labelled, search]);

  if (sheets.length <= 1) return null;
  return (
    <View className="border-b border-hairline bg-surface">
      {sheets.length > SEARCHABLE_FROM ? (
        <View className="px-4 pt-2">
          <SearchField value={search} onChange={setSearch} placeholder="Find a sheet by number or title" />
        </View>
      ) : null}

      {shown.length === 0 ? (
        <Text tone="secondary" className="px-4 py-3 text-[13px]">
          No sheet matches "{search.trim()}".
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center gap-2 px-4 py-2">
            {shown.map(({ sheet, label }) => {
              const active = sheet.id === activeId;
              return (
                <Pressable
                  key={sheet.id}
                  onPress={() => onSelect(sheet.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label.title ? `${label.code}, ${label.title}` : label.code}
                  className={`min-h-11 max-w-56 justify-center rounded-full px-4 py-1 ${active ? "bg-primary-50" : "bg-surface-alt"}`}
                >
                  <Text weight="semibold" numberOfLines={1} className={`text-xs ${active ? "text-primary-600" : "text-grey-400"}`}>
                    {label.code}
                  </Text>
                  {label.title ? (
                    <Text tone={active ? "brand" : "secondary"} numberOfLines={1} className="text-[10px]">
                      {label.title}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
