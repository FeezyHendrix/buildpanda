import type { MeasuredBoqItem, PreconBillRow, PreconBoqRowRow, PreconGeometryRow } from "../types.ts";
import { generateId } from "../../../lib/ids.ts";

// Standard preliminaries clauses (BESMM/JCT-style) drafted as unpriced rows —
// the QS prices or strikes them in review.
const PRELIMS_CLAUSES = [
  "Contractor's obligations",
  "Architect's/S.O's instructions",
  "Contract documents",
  "Statutory obligations, notices, fees and charges",
  "Levels and setting out of the works",
  "Materials, goods and workmanship to conform to description",
  "Foreman-in-charge",
  "Access for Architect/S.O to the works",
  "Variation, provisional and prime cost sums",
  "Practical completion and defects liability",
  "Injury to persons and property and employer's indemnity",
  "Insurance of the works against fire, etc.",
  "Water and electricity for the works",
  "Temporary site accommodation and storage",
  "Scaffolding, plant and site security",
  "Removing rubbish and cleaning on completion",
];

export interface DraftedBoq {
  bills: Omit<PreconBillRow, "created_at">[];
  rows: Omit<PreconBoqRowRow, "created_at" | "updated_at">[];
  geometries: Omit<PreconGeometryRow, "created_at">[];
}

interface RowSeed {
  bill_id: string;
  row_type: PreconBoqRowRow["row_type"];
  element_group?: string | null;
  code?: string | null;
  description: string;
  unit?: string | null;
  qty_gross?: number | null;
  deductions?: PreconBoqRowRow["deductions"];
  qty?: number | null;
  confidence?: PreconBoqRowRow["confidence"];
  status?: PreconBoqRowRow["status"];
  measurement_basis?: string | null;
}

export function draftBoq(sessionId: string, items: MeasuredBoqItem[], sheetIdByPage: Map<number, string>): DraftedBoq {
  const prelimsBill: Omit<PreconBillRow, "created_at"> = {
    id: generateId("pbl"),
    session_id: sessionId,
    title: "Bill No. 1 — Preliminaries and general clauses",
    sort: 0,
  };
  const measuredBill: Omit<PreconBillRow, "created_at"> = {
    id: generateId("pbl"),
    session_id: sessionId,
    title: "Bill No. 2 — Measured works",
    sort: 1,
  };

  const seeds: RowSeed[] = [];

  seeds.push({
    bill_id: prelimsBill.id,
    row_type: "heading",
    description: "PRELIMINARIES AND GENERAL CLAUSES",
  });
  seeds.push({
    bill_id: prelimsBill.id,
    row_type: "spec_note",
    description:
      "The Articles of Agreement and Conditions of Contract are to apply. The following clauses are to be read as part of these bills.",
  });
  for (const clause of PRELIMS_CLAUSES) {
    seeds.push({
      bill_id: prelimsBill.id,
      row_type: "item",
      element_group: "Preliminaries",
      description: clause,
      unit: "item",
      status: "ai_generated",
      confidence: "high",
      measurement_basis: "Standard preliminaries clause",
    });
  }

  // measured works, grouped: element -> work section -> spec note -> items
  const geometries: DraftedBoq["geometries"] = [];
  const rowsWithGeometry: { seed: RowSeed; item: MeasuredBoqItem }[] = [];
  const byElement = new Map<string, MeasuredBoqItem[]>();
  for (const item of items) {
    const list = byElement.get(item.elementGroup);
    if (list) list.push(item);
    else byElement.set(item.elementGroup, [item]);
  }

  for (const [element, elementItems] of byElement) {
    seeds.push({ bill_id: measuredBill.id, row_type: "heading", element_group: element, description: element.toUpperCase() });
    const bySection = new Map<string, MeasuredBoqItem[]>();
    for (const item of elementItems) {
      const key = `${item.workSection.code} ${item.workSection.title}`;
      const list = bySection.get(key);
      if (list) list.push(item);
      else bySection.set(key, [item]);
    }
    for (const [section, sectionItems] of bySection) {
      seeds.push({
        bill_id: measuredBill.id,
        row_type: "work_section",
        element_group: element,
        code: sectionItems[0]!.workSection.code,
        description: section,
      });
      const notes = [...new Set(sectionItems.map((i) => i.specNote).filter((n): n is string => n !== null))];
      for (const note of notes) {
        seeds.push({ bill_id: measuredBill.id, row_type: "spec_note", element_group: element, description: note });
      }
      for (const item of sectionItems) {
        const seed: RowSeed = {
          bill_id: measuredBill.id,
          row_type: "item",
          element_group: element,
          code: item.code,
          description: item.description,
          unit: item.unit,
          qty_gross: item.qtyGross,
          deductions: item.deductions.map((d) => ({ ...d, geometryId: null })),
          qty: item.qty,
          confidence: item.confidence,
          status: item.confidence === "high" ? "ai_generated" : "needs_review",
          measurement_basis: item.measurementBasis,
        };
        seeds.push(seed);
        rowsWithGeometry.push({ seed, item });
      }
    }
  }

  const rows: DraftedBoq["rows"] = seeds.map((seed, index) => ({
    id: generateId("pbr"),
    bill_id: seed.bill_id,
    sort: index,
    row_type: seed.row_type,
    element_group: seed.element_group ?? null,
    code: seed.code ?? null,
    description: seed.description,
    unit: seed.unit ?? null,
    qty_gross: seed.qty_gross ?? null,
    deductions: seed.deductions ?? [],
    qty: seed.qty ?? null,
    rate: null,
    amount: null,
    rate_source: null,
    confidence: seed.confidence ?? null,
    status: seed.status ?? null,
    version: 1,
    measurement_basis: seed.measurement_basis ?? null,
    verified_by: null,
    verified_at: null,
  }));

  const rowIdBySeed = new Map<RowSeed, string>();
  seeds.forEach((seed, index) => rowIdBySeed.set(seed, rows[index]!.id));

  for (const { seed, item } of rowsWithGeometry) {
    const rowId = rowIdBySeed.get(seed)!;
    for (const g of item.geometries) {
      const sheetId = sheetIdByPage.get(g.pageNumber ?? item.pageNumber);
      if (!sheetId) continue;
      geometries.push({
        id: generateId("pgeo"),
        row_id: rowId,
        sheet_id: sheetId,
        kind: g.kind,
        vertices: g.vertices,
        source: "ai",
        quantity: g.quantity,
        unit: g.unit,
      });
    }
  }

  return { bills: [prelimsBill, measuredBill], rows, geometries };
}
