import { useEffect, type RefObject } from "react";
import type { View } from "react-native";

/** Enriched's web adapter does not forward the native accessibility props. */
export function useEditorAccessibility(container: RefObject<View | null>, label: string) {
  useEffect(() => {
    const node = container.current as unknown as HTMLElement | null;
    if (!node) return;
    const apply = () => {
      const input = node.querySelector('[contenteditable]');
      input?.setAttribute('role', 'textbox');
      input?.setAttribute('aria-label', label);
      input?.setAttribute('aria-multiline', 'true');
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [container, label]);
}
