import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { LAYER_ELEMENTS, type LayerElement, type LayerMap } from "@/api/precon";
import { usePreconSnapshot, useUpdatePreconLayerMap } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  sessionId: string;
}

const FIELD = "h-7 w-full rounded-md border-0 bg-[#F6F6F6] px-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";

const ELEMENT_LABELS: Record<LayerElement, string> = {
  walls: "Walls",
  columns: "Columns",
  doors: "Doors",
  windows: "Windows",
  sanitary: "Sanitary",
  stairs: "Stairs",
  roof: "Roof",
  furniture: "Furniture",
  dimensions: "Dimensions",
  text: "Text",
  grid: "Grid",
  levels: "Level marks",
  ignore: "Ignore",
  auto: "Auto (by content)",
};

/**
 * Which element each DWG layer holds. The engine proposes the map from layer
 * names and contents; the reviewer corrects it here and the drawing is
 * measured again with the corrected map. Verified lines are kept.
 */
export function LayerMapTable({ sessionId }: Props) {
  const { data: snapshot } = usePreconSnapshot(sessionId);
  const update = useUpdatePreconLayerMap(sessionId);
  const stored = snapshot?.session.layerMap ?? null;
  const [draft, setDraft] = useState<LayerMap | null>(null);
  const generating = snapshot?.session.status === "generating";
  if (!stored) return null;
  const map = draft ?? stored;
  const layers = Object.keys(map).sort((a, b) => a.localeCompare(b));
  const dirty = draft !== null && layers.some((l) => draft[l] !== stored[l]);

  const save = () => {
    if (!draft) return;
    update.mutate(draft, {
      onSuccess: () => {
        setDraft(null);
        toast("Re-measuring with the corrected layer map. Unverified lines will be replaced.", "info");
      },
      onError: (e) => toast(getApiErrorMessage(e, "Could not update the layer map."), "error"),
    });
  };

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-900">Layer map</p>
        <p className="text-[11px] text-gray-500">{layers.length} layers</p>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100">
        <table className="w-full text-xs">
          <tbody>
            {layers.map((layer) => (
              <tr key={layer} className="border-b border-gray-50 last:border-0">
                <td className="max-w-28 truncate px-2 py-1 font-mono text-[11px] text-gray-700" title={layer}>
                  {layer}
                </td>
                <td className="px-1 py-1">
                  <select
                    className={FIELD}
                    aria-label={`Element on layer ${layer}`}
                    value={map[layer]}
                    disabled={generating}
                    onChange={(e) => setDraft({ ...map, [layer]: e.target.value as LayerElement })}
                  >
                    {LAYER_ELEMENTS.map((el) => (
                      <option key={el} value={el}>
                        {ELEMENT_LABELS[el]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" loading={update.isPending} disabled={!dirty || generating} onClick={save}>
          Save and re-measure
        </Button>
        {dirty ? (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setDraft(null)}>
            Discard
          </button>
        ) : null}
      </div>
    </div>
  );
}
LayerMapTable.displayName = "LayerMapTable";
