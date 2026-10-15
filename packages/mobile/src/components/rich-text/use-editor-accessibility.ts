import type { RefObject } from "react";
import type { View } from "react-native";

// Native EnrichedTextInput accepts accessibilityLabel directly.
export function useEditorAccessibility(_container: RefObject<View | null>, _label: string) {}
