import {
  BrickWall,
  Box,
  Layers,
  Layers2,
  ListTree,
  MapPin,
  MessageSquare,
  MousePointer2,
  PaintBucket,
  Pentagon,
  Ruler,
  Scaling,
  ScanSearch,
  Scissors,
  Spline,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { PreconTool } from "@/lib/precon-meta";

// The same icon for a tool everywhere it is mentioned: palette, legend, the
// evidence panel and Panda AI's change preview (brief section 07).
export const TOOL_ICONS: Record<PreconTool, LucideIcon> = {
  select: MousePointer2,
  magnifier: ZoomIn,
  length: Ruler,
  linear: Spline,
  area: Pentagon,
  room_fill: PaintBucket,
  count: MapPin,
  volume: Box,
  wall_area: BrickWall,
  deduct: Scissors,
  typical: Layers2,
  scale: Scaling,
  find_symbol: ScanSearch,
  overlay: Layers,
  legend: ListTree,
  comment: MessageSquare,
};
