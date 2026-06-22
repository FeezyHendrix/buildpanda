import { loadDwg, calibrate, clusterDrawings, type Cluster } from "./phase1-cluster.ts";
import { countElements } from "./phase1-signatures.ts";
import { DATA_DIR } from "./types.ts";

// Heuristic drawing classifier from geometry + member layers. A floor plan is
// roughly square, has rooms/walls, and a high door/window/sanitary presence;
// elevations are wide-and-short with no plan elements.
function classifyDrawing(doc: ReturnType<typeof loadDwg>, c: Cluster): string {
  const layers = new Set<string>();
  let walls = 0;
  let doors = 0;
  for (const i of c.members) {
    const e = doc.entities[i]!;
    const ln = doc.layerName(e);
    layers.add(ln);
    if (/wall/i.test(ln)) walls++;
    if (/door|wind/i.test(ln)) doors++;
  }
  const aspect = c.widthM / Math.max(c.heightM, 0.1);
  const squareish = aspect > 0.5 && aspect < 2.0;
  const hasPlanElements = walls > 20 && doors > 5;
  if (squareish && hasPlanElements && c.widthM > 8 && c.heightM > 8) return "floor-plan";
  if (aspect > 2.5 && doors === 0) return "elevation";
  if (c.widthM < 8 || c.heightM < 8) return "detail";
  return "unknown";
}

function main(): void {
  const dwg = process.argv[2] ?? `${DATA_DIR}/samples/dwg/BOF-AT-Ogudu-ARC1.dwg`;
  console.log("=".repeat(72));
  console.log("PHASE 1 — Drawing segmentation + element signature counting");
  console.log("=".repeat(72));

  const doc = loadDwg(dwg);
  const cal = calibrate(doc);
  console.log(`\nParsed ${doc.entities.length} entities. Scale ${cal.scaleToMm} mm/unit, ${(cal.confidence * 100).toFixed(0)}% conf (${cal.samples} dims)\n`);

  const clusters = clusterDrawings(doc, cal.scaleToMm, { epsMm: 4000, minPts: 8 });
  console.log(`Segmented sheet into ${clusters.length} drawings:\n`);

  const plans: Array<{ c: Cluster; kind: string }> = [];
  for (const c of clusters) {
    const kind = classifyDrawing(doc, c);
    if (kind === "floor-plan") plans.push({ c, kind });
    console.log(`  #${String(c.id).padStart(2)} [${kind.padEnd(11)}] ${c.count} ents, ${c.widthM.toFixed(1)}m x ${c.heightM.toFixed(1)}m`);
  }

  if (plans.length === 0) {
    console.log("\nNo floor plans detected — would prompt the QS to pick a drawing.");
    return;
  }

  // De-duplicate identical floor plans (same footprint repeated = ground/1st/2nd
  // floors). For counting we use ONE representative, not the sum.
  const rep = plans.sort((a, b) => b.c.count - a.c.count)[0]!;
  console.log(`\nDetected ${plans.length} floor-plan drawings (likely repeated floors).`);
  console.log(`Counting elements within ONE representative plan (#${rep.c.id}, ${rep.c.widthM.toFixed(1)}m x ${rep.c.heightM.toFixed(1)}m):\n`);

  const counts = countElements(doc, new Set(rep.c.members), cal.scaleToMm);
  if (counts.length === 0) {
    console.log("  (no recognised element signatures in this plan)");
  }
  for (const r of counts) {
    console.log(`  • ${r.element}: ${r.count} ${r.unit}  [${r.confidence}]  — ${r.signature}`);
  }

  console.log("\n" + "-".repeat(72));
  console.log("Compare to naive whole-sheet counting (the old bug):");
  const allCounts = countElements(doc, new Set(doc.entities.map((_, i) => i)), cal.scaleToMm);
  for (const r of allCounts) console.log(`  whole-sheet ${r.element}: ${r.count} (vs ${counts.find((x) => x.element === r.element)?.count ?? 0} per-plan)`);
  console.log("\nDONE.");
}

main();
