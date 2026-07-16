import type {
  Confidence,
  FoundationType,
  StructuralSystem,
  StructureClass,
  StructureContext,
} from "../types.ts";

export interface ClassifyInput {
  sheetTitles: string[];
  text: string;
}

interface Rule {
  test: RegExp;
  weight: number;
}

const CLASS_RULES: Record<Exclude<StructureClass, "unknown">, Rule[]> = {
  road: [
    { test: /\b(carriageway|pavement\s+design|road\s+(plan|section|layout)|chainage|sub-?base|road\s*base|kerb|camber|cross[-\s]?fall)\b/i, weight: 3 },
    { test: /\b(asphalt|bitumen|wearing\s+course|binder\s+course|CBR)\b/i, weight: 2 },
  ],
  bridge: [
    { test: /\b(bridge|deck\s+slab|abutment|pier\s+(cap|column)|bearing|parapet|span|girder|prestress|post[-\s]?tension)\b/i, weight: 3 },
    { test: /\b(pile\s+cap|bored\s+pile|deck)\b/i, weight: 1 },
  ],
  airport: [
    { test: /\b(runway|taxiway|apron|airfield|airport|aircraft\s+stand|PCN)\b/i, weight: 3 },
  ],
  infrastructure: [
    { test: /\b(culvert|retaining\s+wall|drainage\s+network|manhole\s+schedule|sewer|pipeline|dam|reservoir|tunnel)\b/i, weight: 2 },
  ],
  building: [
    { test: /\b(floor\s+plan|ground\s+floor|first\s+floor|typical\s+floor|bedroom|kitchen|living|elevation|roof\s+plan)\b/i, weight: 3 },
    { test: /\b(door\s+schedule|window\s+schedule|blockwork|column\s+schedule|beam\s+schedule)\b/i, weight: 1 },
  ],
};

function scoreClasses(haystack: string): { cls: StructureClass; score: number; hits: string[] } {
  let best: StructureClass = "unknown";
  let bestScore = 0;
  const hits: string[] = [];
  for (const [cls, rules] of Object.entries(CLASS_RULES) as [Exclude<StructureClass, "unknown">, Rule[]][]) {
    let score = 0;
    for (const rule of rules) {
      const m = haystack.match(rule.test);
      if (m) {
        score += rule.weight;
        hits.push(`${cls}:${m[0].toLowerCase().replace(/\s+/g, " ")}`);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cls;
    }
  }
  return { cls: best, score: bestScore, hits };
}

function countStoreys(haystack: string): number | null {
  const floorWords = [...haystack.matchAll(/\b(ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d{1,2}(?:st|nd|rd|th))\s+floor\b/gi)];
  const explicit = haystack.match(/\b(\d{1,3})\s*(?:storey|storeys|stories|floors?)\b/i);
  const fromExplicit = explicit ? Number(explicit[1]) : 0;
  const fromWords = floorWords.length;
  const storeys = Math.max(fromExplicit, fromWords);
  return storeys > 0 ? storeys : null;
}

function detectSystem(haystack: string, storeys: number | null): StructuralSystem {
  if (/\b(steel\s+frame|universal\s+beam|UB\s|UC\s|structural\s+steel)\b/i.test(haystack)) return "steel-frame";
  if (/\b(column\s+schedule|beam\s+schedule|rc\s+frame|reinforced\s+concrete\s+frame|bar\s+bending)\b/i.test(haystack)) return "reinforced-concrete-frame";
  if (/\b(blockwork|load[-\s]?bearing|brickwork)\b/i.test(haystack) && (storeys ?? 1) <= 3) return "load-bearing-masonry";
  if (storeys !== null && storeys >= 4) return "reinforced-concrete-frame";
  return "unknown";
}

function detectFoundation(haystack: string, storeys: number | null): FoundationType {
  if (/\b(pile\s+(schedule|cap|layout)|bored\s+pile|driven\s+pile|CFA\s+pile)\b/i.test(haystack)) return "pile";
  if (/\braft\s+(foundation|slab)\b/i.test(haystack)) return "raft";
  if (/\bpad\s+(foundation|footing)\b/i.test(haystack)) return "pad";
  if (/\bstrip\s+(foundation|footing)\b/i.test(haystack)) return "strip";
  if (storeys !== null && storeys >= 6) return "pile";
  if (storeys !== null && storeys <= 2) return "strip";
  return "unknown";
}

export function classifyStructure(input: ClassifyInput): StructureContext {
  const haystack = `${input.sheetTitles.join(" \n ")} \n ${input.text}`.slice(0, 20000);
  const { cls, score, hits } = scoreClasses(haystack);
  const storeys = cls === "building" ? countStoreys(haystack) : null;
  const structuralSystem = cls === "building" ? detectSystem(haystack, storeys) : "unknown";
  const foundationType = cls === "building" || cls === "bridge" ? detectFoundation(haystack, storeys) : "unknown";

  let buildingType: string | null = null;
  if (cls === "building") {
    if (storeys !== null && storeys >= 10) buildingType = "high-rise";
    else if (storeys !== null && storeys >= 4) buildingType = "mid-rise";
    else if (/\bbungalow\b/i.test(haystack)) buildingType = "bungalow";
    else buildingType = "low-rise";
  }

  const confidence: Confidence = score >= 3 ? "high" : "low";
  return {
    structureClass: score >= 2 ? cls : "unknown",
    buildingType,
    storeys,
    structuralSystem,
    foundationType,
    confidence,
    signals: hits.slice(0, 12),
  };
}
