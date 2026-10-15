import { StyleSheet } from "react-native";
import type { HtmlStyle } from "react-native-enriched-html";
import { palette } from "@/constants/colors";

export const enrichedHtmlStyle: HtmlStyle = {
  a: { color: palette.primary500, textDecorationLine: "underline" },
  blockquote: { color: palette.grey600, borderColor: palette.hairline, borderWidth: 3, gapWidth: 10 },
  ul: { bulletColor: palette.black500, marginLeft: 20, gapWidth: 8 },
  ol: { markerColor: palette.black500, marginLeft: 20, gapWidth: 8 },
  code: { color: palette.black500, backgroundColor: palette.surfaceAlt },
};
export const enrichedStyles = StyleSheet.create({
  text: { color: palette.black500, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24 },
  editor: { minHeight: 150, padding: 12 },
  compact: { minHeight: 72, maxHeight: 160 },
});
export const enrichedSanitization = { linkRegex: /^(?:https?:\/\/|mailto:|tel:|blob:|file:|about:blank#|\/files\/)/i };
