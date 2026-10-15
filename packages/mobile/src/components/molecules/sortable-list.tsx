import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { Animated, FlatList, PanResponder, Platform, View, type ViewStyle } from "react-native";
import { ICON_MUTED } from "@/constants/colors";
import { useSortableList } from "@/hooks/use-sortable-list";

interface SortableListProps<T> {
  data: readonly T[];
  rowHeight: number;
  keyExtractor: (item: T) => string;
  labelExtractor: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (props: { item: T; index: number; dragging: boolean; dragHandle: ReactNode }) => ReactNode;
  header?: ReactElement;
  footer?: ReactElement;
  disabled?: boolean;
}

function DragHandle({ label, index, count, disabled, onBegin, onMove, onFinish, onCancel, onMoveBy }: {
  label: string;
  index: number;
  count: number;
  disabled: boolean;
  onBegin: (pageY: number) => void;
  onMove: (pageY: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  onMoveBy: (by: -1 | 1) => void;
}) {
  const latest = useRef({ disabled, onBegin, onMove, onFinish, onCancel, onMoveBy });
  latest.current = { disabled, onBegin, onMove, onFinish, onCancel, onMoveBy };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: (event) => latest.current.onBegin(event.nativeEvent.pageY),
    onPanResponderMove: (event) => latest.current.onMove(event.nativeEvent.pageY),
    onPanResponderRelease: () => latest.current.onFinish(),
    onPanResponderTerminate: () => latest.current.onCancel(),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const webProps = Platform.OS === "web" ? {
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (latest.current.disabled || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      latest.current.onMoveBy(event.key === "ArrowUp" ? -1 : 1);
    },
    style: { cursor: disabled ? "auto" : "grab", touchAction: "none" } as ViewStyle,
  } : {};
  return (
    <View {...pan.panHandlers} {...webProps} accessible focusable
      accessibilityRole="adjustable" accessibilityLabel={`Reorder ${label}`}
      accessibilityHint="Drag up or down to rearrange. You can also use the increase and decrease actions."
      accessibilityValue={{ min: 1, max: count, now: index + 1, text: `Position ${index + 1} of ${count}` }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: "decrement", label: "Move up" }, { name: "increment", label: "Move down" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onMoveBy(1);
        if (event.nativeEvent.actionName === "decrement") onMoveBy(-1);
      }}
      className="h-12 w-12 items-center justify-center rounded-lg">
      <Ionicons name="reorder-three-outline" size={26} color={ICON_MUTED} />
    </View>
  );
}

function SortableRow({ active, displacement, translation, height, children }: {
  active: boolean; displacement: number; translation: Animated.Value; height: number; children: ReactNode;
}) {
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(shift, { toValue: displacement, duration: 140, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [displacement, shift]);
  return <Animated.View style={{ height, zIndex: active ? 2 : 0, transform: [{ translateY: active ? translation : shift }] }}
    className={active ? "border border-primary-500 bg-primary-50" : "border-b border-hairline bg-surface"}>
    {children}
  </Animated.View>;
}

/** A handle-driven list with edge scrolling and accessible reorder actions. */
export function SortableList<T>({ data, rowHeight, keyExtractor, labelExtractor, onReorder, renderItem, header, footer, disabled = false }: SortableListProps<T>) {
  const sort = useSortableList({ data, rowHeight, keyExtractor, labelExtractor, onReorder, disabled });
  return <View ref={sort.viewport} onLayout={sort.measure} className="flex-1">
    <FlatList ref={sort.list} data={data} keyExtractor={keyExtractor}
      scrollEnabled={!sort.position} removeClippedSubviews={false}
      initialNumToRender={data.length} extraData={sort.position}
      onScroll={(event) => sort.onScroll(event.nativeEvent.contentOffset.y)} scrollEventThrottle={16}
      onContentSizeChange={sort.onContentSizeChange}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={header} ListFooterComponent={footer}
      renderItem={({ item, index }) => {
        const key = keyExtractor(item);
        const active = sort.position?.key === key;
        const position = sort.position;
        const displacement = !position || active ? 0
          : index > position.from && index <= position.to ? -rowHeight
          : index < position.from && index >= position.to ? rowHeight : 0;
        return <SortableRow active={active} displacement={displacement} translation={sort.translation} height={rowHeight}>
          {renderItem({ item, index, dragging: active, dragHandle: <DragHandle
            label={labelExtractor(item)} index={index} count={data.length} disabled={disabled}
            onBegin={(pageY) => sort.begin(key, pageY)} onMove={sort.move}
            onFinish={sort.finish} onCancel={sort.cancel} onMoveBy={(by) => sort.moveBy(key, by)} /> })}
        </SortableRow>;
      }} />
  </View>;
}
