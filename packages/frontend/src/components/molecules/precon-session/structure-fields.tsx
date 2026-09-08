import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import type { FoundationType, PreconSession, StructuralSystem, StructureClass } from "@/api/precon";
import { useRedraftPreconBill, useUpdatePreconStructure } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { FOUNDATION_TYPE_OPTIONS, STRUCTURAL_SYSTEM_OPTIONS, STRUCTURE_CLASS_OPTIONS } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";

interface Props {
  session: PreconSession;
  onClose: () => void;
}

const FIELD = "mt-0.5 h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";

/**
 * The engine's reading of what the building is, editable. It steers the bill
 * build-up and the programme, so a wrong reading is worth fixing and redrafting.
 */
export function StructureFields({ session, onClose }: Props) {
  const ctx = session.structureContext;
  const update = useUpdatePreconStructure(session.id);
  const redraft = useRedraftPreconBill(session.id);
  const [structureClass, setStructureClass] = useState<StructureClass>(ctx?.structureClass ?? "building");
  const [buildingType, setBuildingType] = useState(ctx?.buildingType ?? "");
  const [storeys, setStoreys] = useState(ctx?.storeys !== null && ctx?.storeys !== undefined ? String(ctx.storeys) : "");
  const [structuralSystem, setStructuralSystem] = useState<StructuralSystem>(ctx?.structuralSystem ?? "unknown");
  const [foundationType, setFoundationType] = useState<FoundationType>(ctx?.foundationType ?? "unknown");
  const [saved, setSaved] = useState(false);

  const save = () => {
    const storeysValue = storeys.trim() === "" ? null : Number(storeys);
    if (storeysValue !== null && (!Number.isInteger(storeysValue) || storeysValue < 0)) {
      toast("Storeys must be a whole number.", "error");
      return;
    }
    update.mutate(
      {
        structureClass,
        buildingType: buildingType.trim() === "" ? null : buildingType.trim(),
        storeys: storeysValue,
        structuralSystem,
        foundationType,
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast("Structure reading saved.", "success");
        },
        onError: (e) => toast(getApiErrorMessage(e, "Could not save the structure reading."), "error"),
      },
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-900">Structure reading</p>
          <p className="text-[11px] text-gray-500">
            {ctx ? (
              <>
                {ctx.confidence === "high" ? "Confirmed" : "Read by Panda AI, low confidence"}
                {ctx.signals.length > 0 ? ` · from ${ctx.signals.slice(0, 3).join(", ")}` : ""}
              </>
            ) : (
              "Not read yet. Set it to guide the bill build-up and the programme."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ctx ? <Badge tone={ctx.confidence === "high" ? "success" : "warning"}>{ctx.confidence === "high" ? "Confirmed" : "Low confidence"}</Badge> : null}
          <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">
            Close
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <label className="block text-xs text-gray-500">
          Class
          <select className={FIELD} value={structureClass} onChange={(e) => setStructureClass(e.target.value as StructureClass)}>
            {STRUCTURE_CLASS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Building type
          <input className={FIELD} value={buildingType} onChange={(e) => setBuildingType(e.target.value)} placeholder="bungalow, duplex, office…" />
        </label>
        <label className="block text-xs text-gray-500">
          Storeys
          <input className={FIELD} inputMode="numeric" value={storeys} onChange={(e) => setStoreys(e.target.value)} placeholder="1" />
        </label>
        <label className="block text-xs text-gray-500">
          Structural system
          <select className={FIELD} value={structuralSystem} onChange={(e) => setStructuralSystem(e.target.value as StructuralSystem)}>
            {STRUCTURAL_SYSTEM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Foundation
          <select className={FIELD} value={foundationType} onChange={(e) => setFoundationType(e.target.value as FoundationType)}>
            {FOUNDATION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <Button size="sm" loading={update.isPending} onClick={save}>
          Save reading
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={redraft.isPending}
          disabled={session.status !== "reviewing" || (!saved && !ctx)}
          title="Re-run the QS build-up on unverified lines only. Verified and measured lines are untouched."
          onClick={() =>
            redraft.mutate(undefined, {
              onSuccess: () => toast("Redrafting unverified lines against this structure. Verified lines are untouched.", "info"),
              onError: (e) => toast(getApiErrorMessage(e, "Could not redraft the bill."), "error"),
            })
          }
        >
          Redraft unverified lines
        </Button>
        {saved ? <span className="text-xs text-gray-500">Saved. Redraft to apply it to the bill.</span> : null}
      </div>
    </div>
  );
}
StructureFields.displayName = "StructureFields";
