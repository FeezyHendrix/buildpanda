import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import {
  SHEET_LAYERS,
  SHEET_TOOL,
  type LayerVisibility,
  type SheetLayer,
  type SheetTool,
} from "./markup-types";

// On a phone the drawing gets the screen and the controls are summoned. A
// resident toolbar above the sheet costs a band of the plan on every screen,
// so the rail floats over the drawing and folds away to a single button.

type Icon = keyof typeof Ionicons.glyphMap;

const TOOLS: { key: SheetTool; icon: Icon; label: string }[] = [
  { key: SHEET_TOOL.PAN, icon: "move-outline", label: "Pan" },
  { key: SHEET_TOOL.COMMENT, icon: "chatbubble-ellipses-outline", label: "Comment" },
  { key: SHEET_TOOL.PEN, icon: "pencil-outline", label: "Pen" },
];

const LAYER_META: Record<SheetLayer, { icon: Icon; label: string }> = {
  ink: { icon: "pencil-outline", label: "Pen" },
  comments: { icon: "chatbubble-ellipses-outline", label: "Comments" },
};

const TOOL_HINTS: Record<SheetTool, string> = {
  pan: "Pinch to zoom · drag to pan · tap a markup to open it",
  comment: "Tap the sheet to comment",
  pen: "Draw on the sheet with your finger",
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
ToolHint.displayName = "ToolHint";

function RailButton({
  icon,
  label,
  active,
  dimmed,
  onPress,
}: {
  icon: Icon;
  label: string;
  active?: boolean;
  dimmed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      className={`h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary-500" : "bg-transparent"}`}
    >
      <Ionicons name={icon} size={19} color={active ? "#FFFFFF" : dimmed ? "#ADADAD" : "#1A1A1A"} />
    </Pressable>
  );
}
RailButton.displayName = "RailButton";

/** Tools and layer switches, floating over the sheet, foldable out of the way. */
export function SheetControls({
  tool,
  onSelectTool,
  layers,
  counts,
  onToggleLayer,
  open,
  onToggleOpen,
}: {
  tool: SheetTool;
  onSelectTool: (tool: SheetTool) => void;
  layers: LayerVisibility;
  counts: Record<SheetLayer, number>;
  onToggleLayer: (layer: SheetLayer) => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <View className="absolute right-3 top-3 items-end gap-2">
      <View className="rounded-full border border-hairline bg-surface/95 p-1 shadow-sm">
        <RailButton
          icon={open ? "chevron-forward" : "options-outline"}
          label={open ? "Hide tools" : "Show tools"}
          onPress={onToggleOpen}
        />
      </View>
      {open ? (
        <View className="items-center gap-1 rounded-full border border-hairline bg-surface/95 p-1 shadow-sm">
          {TOOLS.map((t) => (
            <RailButton key={t.key} icon={t.icon} label={t.label} active={tool === t.key} onPress={() => onSelectTool(t.key)} />
          ))}
          <View className="my-0.5 h-px w-6 bg-hairline" />
          {SHEET_LAYERS.map((layer) => {
            const meta = LAYER_META[layer];
            const on = layers[layer];
            return (
              <View key={layer} className="items-center">
                <RailButton
                  icon={on ? meta.icon : "eye-off-outline"}
                  label={`${on ? "Hide" : "Show"} ${meta.label.toLowerCase()}${counts[layer] ? ` (${counts[layer]})` : ""}`}
                  dimmed={!on}
                  onPress={() => onToggleLayer(layer)}
                />
                {counts[layer] ? (
                  <Text tone="secondary" className="-mt-1 text-[9px] tabular-nums">
                    {counts[layer]}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
SheetControls.displayName = "SheetControls";

/** Page stepper for a multi-page sheet, at the foot of the drawing. */
export function SheetPager({
  pageNo,
  pageCount,
  onChangePage,
}: {
  pageNo: number;
  pageCount: number;
  onChangePage: (pageNo: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center">
      <View className="flex-row items-center gap-1 rounded-full border border-hairline bg-surface/95 px-1 shadow-sm">
        <RailButton icon="chevron-back" label="Previous page" onPress={() => onChangePage(Math.max(1, pageNo - 1))} />
        <Text tone="secondary" className="min-w-12 text-center text-xs tabular-nums">
          {pageNo} / {pageCount}
        </Text>
        <RailButton icon="chevron-forward" label="Next page" onPress={() => onChangePage(Math.min(pageCount, pageNo + 1))} />
      </View>
    </View>
  );
}
SheetPager.displayName = "SheetPager";
