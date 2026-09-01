import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { SHEET_TOOL, type SheetTool } from "./markup-types";

const TOOLS: { key: SheetTool; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: SHEET_TOOL.PAN, icon: "move-outline", label: "Pan" },
  { key: SHEET_TOOL.COMMENT, icon: "chatbubble-ellipses-outline", label: "Comment" },
  { key: SHEET_TOOL.PEN, icon: "pencil-outline", label: "Pen" },
  { key: SHEET_TOOL.CLOUD, icon: "square-outline", label: "Cloud" },
];

const TOOL_HINTS: Record<SheetTool, string> = {
  pan: "Pinch to zoom · drag to pan · tap a markup to open it",
  comment: "Tap the sheet to comment",
  pen: "Draw on the sheet with your finger",
  cloud: "Drag a box around the area to cloud",
};

export function ToolHint({ tool }: { tool: SheetTool }) {
  return (
    <View className="border-t border-hairline bg-surface px-4 py-3">
      <Text tone="secondary" className="text-center text-xs">
        {TOOL_HINTS[tool]}
      </Text>
    </View>
  );
}

export function ReviewToolbar({
  tool,
  onSelectTool,
  pageNo,
  pageCount,
  onChangePage,
}: {
  tool: SheetTool;
  onSelectTool: (tool: SheetTool) => void;
  pageNo: number;
  pageCount: number;
  onChangePage: (pageNo: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-2 border-b border-hairline bg-surface px-4 py-2">
      {TOOLS.map((t) => {
        const active = tool === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelectTool(t.key)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            className={`h-11 flex-row items-center gap-1.5 rounded-full px-3.5 ${active ? "bg-primary-500" : "bg-surface-alt"}`}
          >
            <Ionicons name={t.icon} size={17} color={active ? "#FFFFFF" : "#5C5C5C"} />
            <Text weight="semibold" className={`text-[13px] ${active ? "text-white" : "text-ink-secondary"}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
      <View className="flex-1" />
      {pageCount > 1 ? (
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => onChangePage(Math.max(1, pageNo - 1))}
            disabled={pageNo <= 1}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name="chevron-back" size={20} color={pageNo <= 1 ? "#ADADAD" : "#1A1A1A"} />
          </Pressable>
          <Text tone="secondary" className="text-xs">
            {pageNo} / {pageCount}
          </Text>
          <Pressable
            onPress={() => onChangePage(Math.min(pageCount, pageNo + 1))}
            disabled={pageNo >= pageCount}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name="chevron-forward" size={20} color={pageNo >= pageCount ? "#ADADAD" : "#1A1A1A"} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
