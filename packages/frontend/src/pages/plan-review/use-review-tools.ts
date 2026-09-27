import { useState } from "react";
import { TOOL, type Tool } from "./plan-review-types";

/** One toolbar controls the tools used by every visible review pane. */
export function useReviewTools() {
  const [activeTool, setActiveTool] = useState<Tool>(TOOL.SELECT);
  const [markupColor, setMarkupColor] = useState("#004DE7");
  const [markupVisible, setMarkupVisible] = useState(true);
  return { activeTool, setActiveTool, markupColor, setMarkupColor, markupVisible, setMarkupVisible };
}
export type ReviewTools = ReturnType<typeof useReviewTools>;
