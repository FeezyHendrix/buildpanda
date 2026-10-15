import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, type FlatList, type View } from "react-native";

interface Drag {
  key: string;
  from: number;
  to: number;
  startY: number;
  pageY: number;
  scrollStart: number;
  keys: string;
}

/** Fixed-height sorting shared by touch handles, keyboard and assistive actions. */
export function useSortableList<T>({ data, rowHeight, keyExtractor, labelExtractor, onReorder, disabled }: {
  data: readonly T[];
  rowHeight: number;
  keyExtractor: (item: T) => string;
  labelExtractor: (item: T) => string;
  onReorder: (items: T[]) => void;
  disabled: boolean;
}) {
  const list = useRef<FlatList<T>>(null);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const bounds = useRef({ top: 0, height: 0 });
  const drag = useRef<Drag | null>(null);
  const translation = useRef(new Animated.Value(0)).current;
  const [position, setPosition] = useState<{ key: string; from: number; to: number } | null>(null);
  const keys = data.map(keyExtractor).join("|");
  const latest = useRef({ data, disabled, keys, onReorder, labelExtractor });
  latest.current = { data, disabled, keys, onReorder, labelExtractor };

  function cancel() {
    drag.current = null;
    translation.setValue(0);
    setPosition(null);
  }

  useEffect(() => {
    if (drag.current && (disabled || drag.current.keys !== keys)) cancel();
  }, [keys, disabled]);

  function measure() {
    viewport.current?.measureInWindow((_x, top, _width, height) => {
      bounds.current = { top, height };
    });
  }

  function update() {
    const active = drag.current;
    if (!active) return;
    const distance = active.pageY - active.startY + offset.current - active.scrollStart;
    const constrained = Math.max(-active.from * rowHeight,
      Math.min((latest.current.data.length - active.from - 1) * rowHeight, distance));
    translation.setValue(constrained);
    const to = Math.max(0, Math.min(latest.current.data.length - 1, Math.round(active.from + constrained / rowHeight)));
    if (to !== active.to) {
      active.to = to;
      setPosition({ key: active.key, from: active.from, to });
    }
  }

  // Continue scrolling while a finger is held near an edge, including when it
  // stops moving. The delta includes the scroll offset so long lists stay sortable.
  useEffect(() => {
    if (!position) return;
    const timer = setInterval(() => {
      const active = drag.current;
      if (!active) return;
      const { top, height } = bounds.current;
      const edge = 64;
      const y = active.pageY - top;
      const speed = y < edge ? -Math.min(1, (edge - y) / edge) * 14
        : y > height - edge ? Math.min(1, (y - height + edge) / edge) * 14 : 0;
      if (!speed) return;
      const next = Math.max(0, Math.min(Math.max(0, contentHeight.current - height), offset.current + speed));
      if (next === offset.current) return;
      offset.current = next;
      list.current?.scrollToOffset({ offset: next, animated: false });
      update();
    }, 16);
    return () => clearInterval(timer);
  }, [position?.key, rowHeight]);

  function reorder(from: number, to: number) {
    const current = latest.current;
    if (current.disabled || from === to || to < 0 || to >= current.data.length) return;
    const next = [...current.data];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    current.onReorder(next);
    AccessibilityInfo.announceForAccessibility(`${current.labelExtractor(item!)} moved to position ${to + 1} of ${next.length}.`);
  }

  return {
    list,
    viewport,
    position,
    translation,
    measure,
    onContentSizeChange: (_width: number, height: number) => { contentHeight.current = height; },
    onScroll: (next: number) => { offset.current = next; update(); },
    begin(key: string, pageY: number) {
      if (latest.current.disabled) return;
      const from = latest.current.data.findIndex((item) => keyExtractor(item) === key);
      if (from < 0) return;
      measure();
      drag.current = { key, from, to: from, startY: pageY, pageY, scrollStart: offset.current, keys: latest.current.keys };
      setPosition({ key, from, to: from });
    },
    move(pageY: number) {
      if (!drag.current) return;
      drag.current.pageY = pageY;
      update();
    },
    finish() {
      const active = drag.current;
      cancel();
      if (active?.keys === latest.current.keys) reorder(active.from, active.to);
    },
    cancel,
    moveBy(key: string, by: -1 | 1) {
      const from = latest.current.data.findIndex((item) => keyExtractor(item) === key);
      if (from >= 0) reorder(from, from + by);
    },
  };
}
