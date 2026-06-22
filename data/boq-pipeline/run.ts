import * as fs from "node:fs";
import { parseDwg, calibrateScale, runTakeoff, layerOf } from "./takeoff.ts";
import { BesmmIndex } from "./rag.ts";
import { buildBoqLines } from "./classify.ts";
import { writeBoqXlsx } from "./xlsx-writer.ts";
import { DATA_DIR, type ProjectMeta, type TakeoffItem } from "./types.ts";

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "GH₵", ZAR: "R", KES: "KES",
};

function measureCleanLayer(model: ReturnType<typeof parseDwg>, cal: ReturnType<typeof calibrateScale>): TakeoffItem[] {
  const toM = cal.scaleToMm / 1000;
  const dist = (a: number[], b: number[]): number => Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  let wallM = 0;
  const inserts: Record<string, number> = {};
  for (const e of model.entities) {
    const ln = layerOf(e, model);
    if (ln === "walls") {
      if (e.entity === "LINE" && e.start && e.end) {
        const L = dist(e.start, e.end) * toM;
        if (L <= 20) wallM += L;
      } else if (e.entity === "LWPOLYLINE" && e.points) {
        for (let i = 1; i < e.points.length; i++) {
          const s = dist(e.points[i - 1]!, e.points[i]!) * toM;
          if (s <= 20) wallM += s;
        }
      }
    }
    if (e.entity === "INSERT") inserts[ln] = (inserts[ln] ?? 0) + 1;
  }
  const wallHeightM = 2.7;
  const centreline = wallM / 2;
  const items: TakeoffItem[] = [];
  if (centreline > 0) {
    items.push({
      trade: "walls",
      layer: "walls",
      description: "Sandcrete block wall in cement mortar (1:6); 225mm thick",
      quantity: Math.round(centreline * wallHeightM * 100) / 100,
      unit: "m2",
      basis: `${centreline.toFixed(1)} m centreline wall (clean 'walls' layer) x ${wallHeightM} m height`,
      assumptions: [`wall height ${wallHeightM} m (not in 2D plan)`, "225mm sandcrete blockwork", "double-line walls halved", "single floor-plan drawing measured"],
    });
  }
  const sanitary = inserts["SANITARY"] ?? 0;
  if (sanitary > 0) {
    items.push({
      trade: "sanitary",
      layer: "SANITARY",
      description: "Sanitary fittings (WC, WHB, etc.) — provisional count",
      quantity: sanitary,
      unit: "nr",
      basis: `${sanitary} sanitary block insertions`,
      assumptions: ["count = block references; verify against schedule"],
    });
  }
  return items;
}

async function main(): Promise<void> {
  const dwgArg = process.argv[2] ?? `${DATA_DIR}/samples/dwg/BOF-AT-Ogudu-ARC1.dwg`;
  const currency = (process.argv[3] ?? "NGN").toUpperCase();
  const project: ProjectMeta = {
    name: "BOF at Ogudu (Floor Plan)",
    currency,
    currencySymbol: CURRENCY_SYMBOLS[currency] ?? currency,
    location: "Ogudu GRA, Lagos, Nigeria",
  };

  console.log("=".repeat(70));
  console.log("BuildPanda DWG → BoQ pipeline");
  console.log("=".repeat(70));

  console.log(`\n[1/5] Parsing DWG: ${dwgArg}`);
  const model = parseDwg(dwgArg);
  console.log(`      ${model.entities.length} entities, ${model.layerNameByHandle.size} layers`);

  console.log("\n[2/5] Calibrating scale from dimensions...");
  const cal = calibrateScale(model);
  console.log(`      scale=${cal.scaleToMm.toFixed(4)} mm/unit, confidence=${(cal.confidence * 100).toFixed(0)}% (${cal.sampleCount} dimensions)`);

  console.log("\n[3/5] Take-off (deterministic measurement)...");
  const items = measureCleanLayer(model, cal);
  for (const it of items) console.log(`      • ${it.quantity} ${it.unit} ${it.description}`);

  console.log("\n[4/5] BESMM4 classification via RAG + pricing...");
  const index = BesmmIndex.load();
  console.log(`      RAG index: ${index.size} BESMM chunks`);
  const lines = await buildBoqLines(items, index);
  for (const l of lines) {
    console.log(`      • [${l.section}${l.sectionCode ? "/" + l.sectionCode : ""}] ${l.quantity} ${l.unit} @ ${l.rate ?? "?"} = ${l.amount ?? "?"} (${l.confidence})`);
  }

  console.log("\n[5/5] Writing priced BoQ XLSX...");
  const outPath = `${DATA_DIR}/samples/boq/GENERATED-Ogudu-BoQ-${currency}.xlsx`;
  const { grandTotal, sections } = writeBoqXlsx(lines, project, outPath);
  console.log(`      ${sections} sections, grand total: ${project.currencySymbol}${grandTotal.toLocaleString()}`);
  console.log(`      -> ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
  console.log("\nDONE.");
}

main().catch((e) => {
  console.error("PIPELINE FAILED:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
