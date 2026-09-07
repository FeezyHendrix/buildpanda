import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { MaterialApproval } from "@/api/material-approvals";

export interface MaterialApprovalReviewerOption {
  id: string;
  name: string;
}

export interface UpsertMaterialApprovalValues {
  title: string;
  materialName: string;
  specification: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  neededBy: string | null;
  requestedReviewerId: string | null;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: MaterialApproval | null;
  reviewerOptions?: MaterialApprovalReviewerOption[];
  onSubmit: (values: UpsertMaterialApprovalValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/** Site-standard units — a free-text unit drifts and breaks reconciliation. */
const UNITS = ["ea", "m", "m2", "m3", "kg", "tonne", "bag", "roll", "litre", "set"] as const;

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";
const area =
  "rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function parseQuantity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function UpsertMaterialApprovalDialog({
  open,
  onOpenChange,
  mode,
  initial,
  reviewerOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [specification, setSpecification] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<string>("ea");
  const [supplier, setSupplier] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [requestedReviewerId, setRequestedReviewerId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setMaterialName(initial?.materialName ?? "");
    setSpecification(initial?.specification ?? "");
    setQuantity(initial ? String(initial.quantity) : "1");
    setUnit(initial?.unit ?? "ea");
    setSupplier(initial?.supplier ?? "");
    setNeededBy(initial?.neededBy ?? "");
    setRequestedReviewerId(initial?.requestedReviewerId ?? "");
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  const canSubmit = title.trim().length > 0 && materialName.trim().length > 0;

  function handleSubmit(): void {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      materialName: materialName.trim(),
      specification: specification.trim() || null,
      quantity: parseQuantity(quantity),
      unit: unit || "ea",
      supplier: supplier.trim() || null,
      neededBy: neededBy || null,
      requestedReviewerId: requestedReviewerId || null,
      description: description.trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Request material approval" : "Edit material request"}
      description="Get a material and its specification signed off before it is ordered or installed."
      submitLabel={mode === "create" ? "Send request" : "Save changes"}
      submitDisabled={!canSubmit}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-title">Request title</Label>
        <input
          id="ma-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Block A external cladding approval"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-material">Material</Label>
        <input
          id="ma-material"
          value={materialName}
          onChange={(e) => setMaterialName(e.target.value)}
          placeholder="e.g. Fibre cement cladding board"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-spec">Specification</Label>
        <textarea
          id="ma-spec"
          value={specification}
          onChange={(e) => setSpecification(e.target.value)}
          rows={3}
          placeholder="Grade, finish, standard, manufacturer reference…"
          className={area}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-qty">Quantity</Label>
          <input
            id="ma-qty"
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-unit">Unit</Label>
          <select
            id="ma-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={field}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-supplier">Supplier</Label>
          <input
            id="ma-supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Proposed supplier"
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ma-needed">Needed by</Label>
          <input
            id="ma-needed"
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-reviewer">Request approval from</Label>
        <select
          id="ma-reviewer"
          value={requestedReviewerId}
          onChange={(e) => setRequestedReviewerId(e.target.value)}
          className={field}
        >
          <option value="">Anyone who can approve materials</option>
          {reviewerOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          Naming a reviewer makes the decision theirs alone; leave blank to let any material
          approver sign it off.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ma-notes">Notes</Label>
        <textarea
          id="ma-notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Why this material, any substitution reasoning, lead-time constraints…"
          className={area}
        />
      </div>
    </FormDrawer>
  );
}

UpsertMaterialApprovalDialog.displayName = "UpsertMaterialApprovalDialog";

export { UpsertMaterialApprovalDialog };
