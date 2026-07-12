import { z } from "zod";
import type { LlmMessage } from "../../../../lib/llm.ts";
import type { Confidence, MeasuredBoqItem } from "../types.ts";
import { BESMM_ELEMENT_BRIEFS, type ElementBrief } from "./besmm-reference.ts";

// ---------------------------------------------------------------------------
// The build-up stage: parallel per-element agents turn the deterministic
// measurement anchors into a BESMM-granular bill. Honesty contract:
//   - the model NEVER outputs a quantity. It outputs either an anchor name,
//     a formula over anchors, or "provisional".
//   - the engine evaluates every formula itself; a formula referencing an
//     unknown anchor kills the item.
// ---------------------------------------------------------------------------

export type Anchors = Record<string, number>;

export function buildAnchors(items: MeasuredBoqItem[]): Anchors {
  const anchors: Anchors = {};
  for (const item of items) {
    if (item.code === "F10/125") {
      anchors["wall_area_m2"] = (anchors["wall_area_m2"] ?? 0) + item.qty;
      // wall area was measured as centreline x 2.7m assumed height, so the
      // centreline is the same measurement expressed in metres
      anchors["wall_centreline_m"] = Math.round(((anchors["wall_area_m2"] ?? 0) / 2.7) * 100) / 100;
    } else if (item.code === "M10") {
      anchors["floor_area_m2"] = (anchors["floor_area_m2"] ?? 0) + item.qty;
    } else if (item.code === "L20") {
      const match = item.description.match(/Door type (D\d+)/i);
      if (match) anchors[`door_${match[1]!.toUpperCase()}`] = item.qty;
      anchors["door_total"] = (anchors["door_total"] ?? 0) + item.qty;
    } else if (item.code === "L11") {
      const match = item.description.match(/Window type (W\d+)/i);
      if (match) anchors[`window_${match[1]!.toUpperCase()}`] = item.qty;
      anchors["window_total"] = (anchors["window_total"] ?? 0) + item.qty;
    }
  }
  return anchors;
}

// Tiny arithmetic evaluator: numbers, anchor identifiers, + - * / and
// parentheses. No eval(), no functions — a formula is data, not code.
export function evaluateFormula(formula: string, anchors: Anchors): number | null {
  const tokens = formula.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[-+*/()]/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== formula.replace(/\s/g, "")) return null;

  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const parsePrimary = (): number | null => {
    const token = next();
    if (token === undefined) return null;
    if (token === "(") {
      const value = parseExpression();
      if (next() !== ")") return null;
      return value;
    }
    if (token === "-") {
      const value = parsePrimary();
      return value === null ? null : -value;
    }
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) return anchors[token] ?? null;
    return null;
  };

  const parseTerm = (): number | null => {
    let left = parsePrimary();
    while (left !== null && (peek() === "*" || peek() === "/")) {
      const op = next();
      const right = parsePrimary();
      if (right === null) return null;
      left = op === "*" ? left * right : right === 0 ? null : left / right;
    }
    return left;
  };

  const parseExpression = (): number | null => {
    let left = parseTerm();
    while (left !== null && (peek() === "+" || peek() === "-")) {
      const op = next();
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const result = parseExpression();
  if (position !== tokens.length || result === null || !Number.isFinite(result) || result < 0) return null;
  return Math.round(result * 100) / 100;
}

const buildupItemSchema = z.object({
  besmmRef: z.string().max(12).nullable().optional(),
  particulars: z.string().min(5).max(240),
  unit: z.enum(["m2", "m3", "m", "nr", "item", "sum", "tonnes"]),
  basis: z.enum(["anchor", "derived", "provisional"]),
  anchor: z.string().max(60).optional(),
  formula: z.string().max(160).optional(),
});

const buildupGroupSchema = z.object({
  preamble: z.string().max(500).nullable(),
  heading: z.string().max(120).nullable(),
  items: z.array(buildupItemSchema).max(15),
});

const buildupSchema = z.object({
  workSections: z
    .array(
      z.object({
        sectionNumber: z.string().min(3).max(8),
        title: z.string().min(3).max(70),
        groups: z.array(buildupGroupSchema).max(8),
      }),
    )
    .max(6),
});

export type BuildupResult = z.infer<typeof buildupSchema>;

export type LlmJsonCall = <T>(messages: LlmMessage[], schema: z.ZodType<T>) => Promise<{ data: T } | null>;

function agentMessages(brief: ElementBrief, anchors: Anchors, sheetContext: string): LlmMessage[] {
  const anchorList = Object.entries(anchors)
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "You are a Nigerian quantity surveyor drafting one element of a Bill of Quantities to BESMM4.",
        "STRUCTURE — bills are three levels, exactly as in the template:",
        "  - workSection: BESMM section number + TITLE (e.g. sectionNumber '1.11', title 'INSITU CONCRETE WORKS').",
        "  - group: 'preamble' is the unnumbered MATERIAL SPECIFICATION paragraph carrying kind/quality/mix/fixing (this is where the rich text lives); 'heading' is an optional short group caption ('Formwork - Plain formwork', 'Reinforcement', 'Door Sets').",
        "  - items: SHORT particulars only — thickness/location/size-band; the spec is NOT repeated. Consecutive similar items start with 'Ditto;'. Finishes split width bands: 'less or equal to 600mm wide' in m, 'over 600mm wide' in m2. besmmRef holds the item reference (e.g. '2.1.1', '34.1.1*2') when the template shows one.",
        "HARD RULES — violations make the output unusable:",
        "1. NEVER output a number as a quantity. For each item choose basis:",
        '   - "anchor": quantity IS one measured anchor; set "anchor" to its exact name.',
        '   - "derived": quantity is a formula over anchor names and constants, e.g. "2 * wall_area_m2" or "wall_area_m2 * 0.012"; set "formula". Only derive relationships a QS would defend (render both faces, paint follows render, one frame per door).',
        '   - "provisional": the drawings cannot support a quantity (needs structural/MEP/roof drawings). unit must be "sum" or "item". No anchor, no formula.',
        "2. Infer like a QS: standard construction build-ups over the anchors are allowed and encouraged — strip foundations follow wall_centreline_m, oversite work follows floor areas, painting follows plastered areas — but EVERY assumed dimension, depth, thickness or factor must be stated in the description with the word 'assumed' (e.g. 'assumed 675mm wide x 900mm deep strip foundation along wall centreline'). An inference you cannot express as a formula over the anchors with stated assumptions stays provisional.",
        "3. At most 20 items for this element. Fewer, correct items beat many speculative ones.",
        'Respond with JSON only, exactly this shape: {"workSections":[{"sectionNumber":"1.11","title":"INSITU CONCRETE WORKS","groups":[{"preamble":"material spec paragraph or null","heading":"group caption or null","items":[{"besmmRef":"2.1.1 or null","particulars":"short particulars","unit":"m2|m3|m|nr|item|sum|tonnes","basis":"anchor|derived|provisional","anchor":"(when basis=anchor)","formula":"(when basis=derived)"}]}]}]}',

      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `ELEMENT: ${brief.element}`,
        `GUIDANCE: ${brief.guidance}`,
        `BILLING TEMPLATE for this element (follow its section numbers, preambles, groups and item style):\n${brief.template}`,
        `MEASURED ANCHORS (the only numbers that exist):\n${anchorList || "(none)"}`,
        `DRAWING CONTEXT: ${sheetContext}`,
      ].join("\n\n"),
    },
  ];
}

export interface EnrichedItem extends MeasuredBoqItem {
  provisional?: boolean;
}

function toItems(brief: ElementBrief, result: BuildupResult, anchors: Anchors): EnrichedItem[] {
  const items: EnrichedItem[] = [];
  for (const section of result.workSections) {
    for (const group of section.groups) {
      let firstOfGroup = true;
      for (const raw of group.items) {
      let qty: number | null = null;
      let basisText: string;
      let confidence: Confidence = "low";
        if (raw.basis === "anchor" && raw.anchor) {
          // the measured bill already carries the anchor quantities themselves;
          // agents add ASSOCIATED work, they must not re-bill the anchor
          if (raw.anchor === "wall_area_m2" || raw.anchor === "floor_area_m2") continue;
          const value = anchors[raw.anchor];
          if (value === undefined) continue;
          qty = value;
          basisText = `Anchor ${raw.anchor} = ${value}`;
        } else if (raw.basis === "derived" && raw.formula) {
          const value = evaluateFormula(raw.formula, anchors);
          if (value === null) continue;
          qty = value;
          basisText = `Derived: ${raw.formula} = ${value} (engine-evaluated over measured anchors)`;
        } else if (raw.basis === "provisional") {
          basisText = "Provisional — supporting drawings required; no quantity claimed";
        } else {
          continue;
        }
        items.push({
          elementGroup: brief.element,
          workSection: { code: section.sectionNumber, title: section.title },
          specNote: firstOfGroup && group.preamble?.trim() ? group.preamble : null,
          groupHeading: firstOfGroup && group.heading?.trim() ? group.heading : null,
          code: raw.besmmRef ?? null,
          description: raw.particulars,
          unit: raw.unit,
          qtyGross: qty ?? 0,
          deductions: [],
          qty: qty ?? 0,
          confidence,
          measurementBasis: basisText,
          geometries: [],
          pageNumber: 0,
          provisional: raw.basis === "provisional",
        });
        firstOfGroup = false;
      }
    }
  }
  return items;
}

export interface EnrichOutcome {
  items: EnrichedItem[];
  agentResults: { element: string; items: number; failed: boolean }[];
}

// Fan out one agent per element in parallel; a failed agent degrades to zero
// items for its element rather than failing the session.
export async function buildUpBill(
  measured: MeasuredBoqItem[],
  sheetContext: string,
  callLlm: LlmJsonCall,
  onProgress: (message: string) => void = () => {},
): Promise<EnrichOutcome> {
  const anchors = buildAnchors(measured);
  const results = await Promise.all(
    BESMM_ELEMENT_BRIEFS.map(async (brief) => {
      try {
        // one retry: a single schema-validation flake should not cost an element
        let response = await callLlm(agentMessages(brief, anchors, sheetContext), buildupSchema).catch(() => null);
        if (!response) response = await callLlm(agentMessages(brief, anchors, sheetContext), buildupSchema);
        if (!response) return { brief, items: [] as EnrichedItem[], failed: true };
        const items = toItems(brief, response.data, anchors);
        onProgress(`Built up ${brief.element}: ${items.length} items`);
        return { brief, items, failed: false };
      } catch {
        onProgress(`Build-up for ${brief.element} failed; element left for manual billing`);
        return { brief, items: [] as EnrichedItem[], failed: true };
      }
    }),
  );
  return {
    items: results.flatMap((r) => r.items),
    agentResults: results.map((r) => ({ element: r.brief.element, items: r.items.length, failed: r.failed })),
  };
}
