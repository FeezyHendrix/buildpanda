import { features } from "@/lib/feature-access";
import { useProjectAccess } from "@/lib/project-access-provider";
import { PermissionGate } from "@/components/molecules/permission-gate";
import Ionicons from "@/components/atoms/icon";
import { useState } from "react";
import { Text } from "@/components/atoms";
import { ICON_DEFAULT, ICON_INVERSE, ICON_MUTED, ICON_SUBTLE } from "@/constants/colors";
import { MARKUP_COLORS, SHEET_LAYERS, SHEET_TOOL, type LayerVisibility, type SheetLayer, type SheetTool } from "./markup-types";
// On a phone the drawing gets the screen and the controls are summoned. A
// resident toolbar above the sheet costs a band of the plan on every screen,
// so the rail floats over the drawing and folds away to a single button.
// The visible tools follow the web's simplified plan-review toolbar, minus its mouse-only
// Select: a tap in Pan already opens a markup here.
type Icon = keyof typeof Ionicons.glyphMap;
const TOOLS: {
    key: SheetTool;
    icon: Icon;
    label: string;
}[] = [
    { key: SHEET_TOOL.PAN, icon: "move-outline", label: "Pan" },
    { key: SHEET_TOOL.COMMENT, icon: "chatbubble-ellipses-outline", label: "Comment" },
    { key: SHEET_TOOL.PEN, icon: "pencil-outline", label: "Pen" },
    { key: SHEET_TOOL.MEASURE, icon: "resize-outline", label: "Measure" },
];
const LAYER_META: Record<SheetLayer, {
    icon: Icon;
    label: string;
}> = {
    ink: { icon: "pencil-outline", label: "Ink" },
    comments: { icon: "chatbubble-ellipses-outline", label: "Comments" },
};
const TOOL_HINTS: Record<SheetTool, string> = {
    pan: "Pinch to zoom · drag to pan · tap a markup to open it",
    comment: "Tap the sheet to comment",
    pen: "Draw on the sheet with your finger",
    cloud: "Drag a box around what changed",
    measure: "Tap two points, or drag, to measure",
};
/** What the active tool does, and for Measure, the sheet's scale and the way to set one. */
export function ToolHint({ tool, scaleLabel, onSetScale, }: {
    tool: SheetTool;
    /** The sheet's scale as text, or null when a measure can only say "no scale set". */
    scaleLabel: string | null;
    onSetScale: () => void;
}) {
    const measuring = tool === SHEET_TOOL.MEASURE;
    return (<div className="field-stack flex-row items-center gap-3 border-t border-hairline bg-surface py-1.5 pl-4 pr-2">
      <Text tone="secondary" className="flex-1 text-xs">
        {TOOL_HINTS[tool]}
        {measuring ? ` · ${scaleLabel ?? "no scale set"}` : ""}
      </Text>
      {measuring ? (<button onClick={onSetScale} role="button" aria-label={scaleLabel ? "Set scale again" : "Set scale"} className="h-11 justify-center rounded-full bg-primary-50 px-4" type="button">
          <Text weight="semibold" tone="brand" className="text-xs">
            {scaleLabel ? "Re-set scale" : "Set scale"}
          </Text>
        </button>) : null}
    </div>);
}
ToolHint.displayName = "ToolHint";
function RailButton({ icon, label, active, dimmed, disabled, onPress, }: {
    icon: Icon;
    label: string;
    active?: boolean;
    dimmed?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (<button onClick={onPress} disabled={disabled} role="button" aria-label={label} aria-pressed={Boolean(active)} aria-disabled={Boolean(disabled)} className={`h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary-500" : "bg-transparent"}`} type="button">
      <Ionicons name={icon} size={19} color={active ? ICON_INVERSE : dimmed || disabled ? ICON_SUBTLE : ICON_DEFAULT}/>
    </button>);
}
RailButton.displayName = "RailButton";
/** The web's six markup colours, one row, the chosen one ringed. */
function ColorRow({ color, onSelect }: {
    color: string;
    onSelect: (value: string) => void;
}) {
    return (<div className="field-stack flex-row items-center rounded-full border border-hairline bg-surface/95 p-1 shadow-sm">
      {MARKUP_COLORS.map((c) => {
            const on = c.value === color;
            return (<button key={c.value} onClick={() => onSelect(c.value)} role="button" aria-label={`${c.label} markup colour`} aria-pressed={on} className="h-11 w-11 items-center justify-center" type="button">
            <div className={"field-stack " + (`items-center justify-center rounded-full ${on ? "h-8 w-8 border-2 border-surface" : "h-6 w-6"}`)} style={{ backgroundColor: c.value }}>
              {on ? <Ionicons name="checkmark" size={14} color={ICON_INVERSE}/> : null}
            </div>
          </button>);
        })}
    </div>);
}
ColorRow.displayName = "ColorRow";
/** Tools, colour, undo, fit and layer switches, floating over the sheet, foldable out of the way. */
export function SheetControls({ tool, onSelectTool, color, onSelectColor, canUndo, onUndo, onFit, layers, counts, onToggleLayer, open, onToggleOpen, }: {
    tool: SheetTool;
    onSelectTool: (tool: SheetTool) => void;
    color: string;
    onSelectColor: (value: string) => void;
    canUndo: boolean;
    onUndo: () => void;
    onFit: () => void;
    layers: LayerVisibility;
    counts: Record<SheetLayer, number>;
    onToggleLayer: (layer: SheetLayer) => void;
    open: boolean;
    onToggleOpen: () => void;
}) {
    const [colorOpen, setColorOpen] = useState(false);
    const { allows } = useProjectAccess();
    const canMarkup = allows(features.documents.actions.markup);
    return (<div className="field-stack absolute right-3 top-3 items-end gap-2">
      <div className="field-stack rounded-full border border-hairline bg-surface/95 p-1 shadow-sm">
        <RailButton icon={open ? "chevron-forward" : "options-outline"} label={open ? "Hide tools" : "Show tools"} onPress={onToggleOpen}/>
      </div>
      {open && colorOpen && canMarkup ? (<ColorRow color={color} onSelect={(value) => {
                onSelectColor(value);
                setColorOpen(false);
            }}/>) : null}
      {open ? (<div className="field-stack items-center gap-1 rounded-full border border-hairline bg-surface/95 p-1 shadow-sm">
          {TOOLS.filter((t) => canMarkup || t.key === SHEET_TOOL.PAN).map((t) => (<RailButton key={t.key} icon={t.icon} label={t.label} active={tool === t.key} onPress={() => onSelectTool(t.key)}/>))}
          <PermissionGate permission={features.documents.actions.markup}><button onClick={() => setColorOpen((v) => !v)} role="button" aria-label="Markup colour" aria-expanded={colorOpen} className="h-11 w-11 items-center justify-center" type="button">
            <div className="field-stack h-6 w-6 rounded-full border-2 border-surface shadow-sm" style={{ backgroundColor: color }}/>
          </button>
          <div className="field-stack my-0.5 h-px w-6 bg-hairline"/>
          <RailButton icon="arrow-undo-outline" label="Undo last markup" disabled={!canUndo} onPress={onUndo}/></PermissionGate>
          <RailButton icon="scan-outline" label="Fit sheet to screen" onPress={onFit}/>
          <div className="field-stack my-0.5 h-px w-6 bg-hairline"/>
          {SHEET_LAYERS.map((layer) => {
                const meta = LAYER_META[layer];
                const on = layers[layer];
                return (<div key={layer} className="field-stack items-center">
                <RailButton icon={on ? meta.icon : "eye-off-outline"} label={`${on ? "Hide" : "Show"} ${meta.label.toLowerCase()}${counts[layer] ? ` (${counts[layer]})` : ""}`} dimmed={!on} onPress={() => onToggleLayer(layer)}/>
                {counts[layer] ? (<Text tone="secondary" className="-mt-1 text-[9px] tabular-nums">
                    {counts[layer]}
                  </Text>) : null}
              </div>);
            })}
        </div>) : null}
    </div>);
}
SheetControls.displayName = "SheetControls";
/** The zoom as a percentage; tapping it fits the sheet to the screen again. */
export function ZoomReadout({ pct, onFit }: {
    pct: number;
    onFit: () => void;
}) {
    return (<button onClick={onFit} role="button" aria-label={`Zoom ${pct} percent. Fit sheet to screen`} className="absolute bottom-3 left-3 h-11 min-w-[56px] items-center justify-center rounded-full border border-hairline bg-surface/95 px-3 shadow-sm" type="button">
      <Text tone="secondary" className="text-xs tabular-nums">
        {pct}%
      </Text>
    </button>);
}
ZoomReadout.displayName = "ZoomReadout";
/** Page stepper for a multi-page sheet, at the foot of the drawing. */
export function SheetPager({ pageNo, pageCount, onChangePage, }: {
    pageNo: number;
    pageCount: number;
    onChangePage: (pageNo: number) => void;
}) {
    if (pageCount <= 1)
        return null;
    return (<div className="field-stack absolute bottom-3 left-0 right-0 flex-row items-center justify-center">
      <div className="field-stack flex-row items-center gap-1 rounded-full border border-hairline bg-surface/95 px-1 shadow-sm">
        <RailButton icon="chevron-back" label="Previous page" onPress={() => onChangePage(Math.max(1, pageNo - 1))}/>
        <Text tone="secondary" className="min-w-12 text-center text-xs tabular-nums">
          {pageNo} / {pageCount}
        </Text>
        <RailButton icon="chevron-forward" label="Next page" onPress={() => onChangePage(Math.min(pageCount, pageNo + 1))}/>
      </div>
    </div>);
}
SheetPager.displayName = "SheetPager";
/**
 * How many markups on this sheet are still waiting for signal. A count over
 * the whole sheet, not one row's badge, so it is a pill of its own rather
 * than `PendingBadge` — but it uses the same glyph and wording.
 */
export function PendingSyncPill({ count }: {
    count: number;
}) {
    if (count < 1)
        return null;
    return (<div aria-label={`${count} waiting to upload`} className="field-stack absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full border border-hairline bg-surface/95 px-3 py-1.5 shadow-sm">
      <Ionicons name="cloud-upload-outline" size={13} color={ICON_MUTED}/>
      <Text tone="secondary" className="text-[11px]">
        {count} pending
      </Text>
    </div>);
}
PendingSyncPill.displayName = "PendingSyncPill";
