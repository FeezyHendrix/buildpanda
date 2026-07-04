import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";
import { useSuppliers } from "@/hooks/use-suppliers";
import type { MaterialCatalogItem, ReorderPolicyInput } from "@/lib/project-types";

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

interface ReorderPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  material: MaterialCatalogItem | null;
  onSubmit: (values: ReorderPolicyInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function numOrNull(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ReorderPolicyDialog({
  open,
  onOpenChange,
  projectId,
  material,
  onSubmit,
  isSubmitting = false,
  error,
}: ReorderPolicyDialogProps) {
  const { data: suppliers = [] } = useSuppliers(projectId);
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [preferredSupplierId, setPreferredSupplierId] = useState("");
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLowStockThreshold(material?.lowStockThreshold != null ? String(material.lowStockThreshold) : "");
    setReorderQuantity(material?.reorderQuantity != null ? String(material.reorderQuantity) : "");
    setLeadTimeDays(material?.leadTimeDays != null ? String(material.leadTimeDays) : "");
    setPreferredSupplierId(material?.preferredSupplierId ?? "");
    setAutoReorderEnabled(material?.autoReorderEnabled ?? false);
  }, [open, material]);

  function handleSubmit(): void {
    onSubmit({
      lowStockThreshold: numOrNull(lowStockThreshold),
      reorderQuantity: numOrNull(reorderQuantity),
      leadTimeDays: numOrNull(leadTimeDays),
      preferredSupplierId: preferredSupplierId || null,
      autoReorderEnabled,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={material ? `Reorder policy — ${material.name}` : "Reorder policy"}
      description="Set the reorder point and, optionally, let BuildPanda raise a material request automatically when stock drops to that level."
      submitLabel="Save policy"
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="policy-threshold">Low stock threshold ({material?.unit ?? "unit"})</Label>
        <input
          id="policy-threshold"
          type="number"
          min={0}
          value={lowStockThreshold}
          onChange={(e) => setLowStockThreshold(e.target.value)}
          placeholder="e.g. 20"
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="policy-reorder-qty">Reorder quantity</Label>
          <input
            id="policy-reorder-qty"
            type="number"
            min={0}
            value={reorderQuantity}
            onChange={(e) => setReorderQuantity(e.target.value)}
            placeholder="e.g. 100"
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="policy-lead-time">Lead time (days)</Label>
          <input
            id="policy-lead-time"
            type="number"
            min={0}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            placeholder="e.g. 7"
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="policy-supplier">Preferred supplier</Label>
        <select
          id="policy-supplier"
          value={preferredSupplierId}
          onChange={(e) => setPreferredSupplierId(e.target.value)}
          className={FIELD}
        >
          <option value="">No preferred supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-[#F6F6F6] px-3 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Auto-create reorder requests</span>
          <span className="text-xs text-gray-500">
            When stock hits the threshold, raise a material request automatically.
          </span>
        </div>
        <ToggleSwitch checked={autoReorderEnabled} onChange={setAutoReorderEnabled} />
      </div>
    </FormDrawer>
  );
}

export { ReorderPolicyDialog };
