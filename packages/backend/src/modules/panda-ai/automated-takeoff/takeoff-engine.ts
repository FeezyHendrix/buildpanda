import { calibrate, parseDwgToJson, type DwgDoc } from "./dwg.ts";
import { classifyDrawing, clusterDrawings, type Cluster } from "./clustering.ts";
import { countElements } from "./signatures.ts";
import type { DrawingSummary, TakeoffResult } from "./types.ts";

function measureWallBlockwork(
  doc: DwgDoc,
  members: number[],
  scaleToMm: number,
  wallHeightM: number,
): TakeoffResult["items"][number] | null {
  const toM = scaleToMm / 1000;
  const maxSegM = 20;
  let raw = 0;
  for (const i of members) {
    const e = doc.entities[i]!;
    if (!/wall/i.test(doc.layerName(e))) continue;
    if (e.entity === "LINE" && e.start && e.end) {
      const len = Math.hypot(e.end[0]! - e.start[0]!, e.end[1]! - e.start[1]!) * toM;
      if (len <= maxSegM) raw += len;
    } else if (e.entity === "LWPOLYLINE" && e.points) {
      for (let k = 1; k < e.points.length; k++) {
        const s = Math.hypot(e.points[k]![0]! - e.points[k - 1]![0]!, e.points[k]![1]! - e.points[k - 1]![1]!) * toM;
        if (s <= maxSegM) raw += s;
      }
    }
  }
  if (raw <= 0) return null;
  const centreline = raw / 2;
  return {
    trade: "walls",
    description: "Sandcrete block wall in cement mortar (1:6); 225mm thick",
    quantity: Math.round(centreline * wallHeightM * 100) / 100,
    unit: "m2",
    confidence: "low",
    basis: `${centreline.toFixed(1)} m centreline wall (double-line halved) x ${wallHeightM} m assumed height`,
  };
}

export interface TakeoffEngineOptions {
  wallHeightM?: number;
}

// Orchestrates the deterministic take-off: parse -> calibrate scale ->
// segment the sheet into drawings -> pick one representative floor plan ->
// measure walls and count elements within it. The LLM is not involved in
// measurement; this stage produces auditable quantities only.
export async function runTakeoffEngine(
  dwgPath: string,
  opts: TakeoffEngineOptions = {},
): Promise<TakeoffResult> {
  const wallHeightM = opts.wallHeightM ?? 2.7;
  const doc = await parseDwgToJson(dwgPath);
  const cal = calibrate(doc);

  const clusters = clusterDrawings(doc, cal.scaleToMm);
  const drawings: DrawingSummary[] = clusters.map((c) => ({
    id: c.id,
    kind: classifyDrawing(doc, c),
    widthM: Math.round(c.widthM * 10) / 10,
    heightM: Math.round(c.heightM * 10) / 10,
    entityCount: c.count,
  }));

  const notes: string[] = [];
  if (cal.confidence < 0.7) {
    notes.push(`Scale calibration confidence is low (${(cal.confidence * 100).toFixed(0)}%); quantities may be unreliable.`);
  }

  const planClusters = clusters.filter((c) => classifyDrawing(doc, c) === "floor-plan");
  const representative: Cluster | null = planClusters[0] ?? clusters[0] ?? null;
  if (!representative) {
    notes.push("No measurable drawing region detected.");
    return { scaleToMm: cal.scaleToMm, scaleConfidence: cal.confidence, drawings, selectedDrawingId: null, items: [], notes };
  }

  if (planClusters.length > 1) {
    notes.push(`${planClusters.length} floor-plan drawings detected (likely repeated floors); measured one representative to avoid multiplying by floor count.`);
  }

  const items = countElements(doc, representative.members, cal.scaleToMm);
  const blockwork = measureWallBlockwork(doc, representative.members, cal.scaleToMm, wallHeightM);
  if (blockwork) items.unshift(blockwork);

  notes.push("Quantities are AI-assisted take-offs with assumptions (e.g. wall height); a quantity surveyor must review before use.");

  return {
    scaleToMm: cal.scaleToMm,
    scaleConfidence: cal.confidence,
    drawings,
    selectedDrawingId: representative.id,
    items,
    notes,
  };
}
