import { generateId } from "../../../lib/ids.ts";
import type { PreconBoqRowRow } from "./types.ts";

// Shape a DWG take-off line into a bill row with everything review expects.
export function dwgRow(
  billId: string,
  sort: number,
  seed: Partial<Omit<PreconBoqRowRow, "id" | "bill_id" | "sort" | "created_at" | "updated_at">> & {
    row_type: PreconBoqRowRow["row_type"];
    description: string;
  },
): Omit<PreconBoqRowRow, "created_at" | "updated_at"> {
  return {
    id: generateId("pbr"),
    bill_id: billId,
    sort,
    row_type: seed.row_type,
    element_group: seed.element_group ?? null,
    code: seed.code ?? null,
    description: seed.description,
    unit: seed.unit ?? null,
    qty_gross: seed.qty_gross ?? null,
    deductions: [],
    qty: seed.qty ?? null,
    rate: null,
    amount: null,
    rate_source: null,
    confidence: seed.confidence ?? null,
    status: seed.status ?? null,
    version: 1,
    measurement_basis: seed.measurement_basis ?? null,
    confidence_reason: seed.confidence_reason ?? null,
    provenance: seed.provenance ?? null,
    evidence: seed.evidence ?? null,
    origin: "ai",
    edited_at: null,
    edited_by: null,
    verified_by: null,
    verified_at: null,
  };
}
