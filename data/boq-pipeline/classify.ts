import { BesmmIndex } from "./rag.ts";
import { CHAT_MODEL, OPENAI_BASE, type BoqLine, type TakeoffItem } from "./types.ts";

const API_KEY = process.env["OPENAI_API_KEY"] ?? "";

// Seed Nigerian rate card (NGN), grounded in the Moniepoint priced BoQ sample.
// Rates are illustrative and MUST be replaced by a maintained regional library.
interface RateEntry {
  keyword: RegExp;
  section: string;
  sectionCode: string | null;
  unit: string;
  rateNgn: number;
}

const RATE_CARD: RateEntry[] = [
  { keyword: /blockwork|block wall|masonry/i, section: "MASONRY", sectionCode: "F10", unit: "m2", rateNgn: 7500 },
  { keyword: /in-situ concrete|concrete bed|rcc/i, section: "IN-SITU CONCRETE", sectionCode: "E10", unit: "m3", rateNgn: 165000 },
  { keyword: /formwork/i, section: "IN-SITU CONCRETE", sectionCode: "E20", unit: "m2", rateNgn: 12000 },
  { keyword: /column|stanchion/i, section: "FRAME", sectionCode: "G10", unit: "nr", rateNgn: 85000 },
  { keyword: /door/i, section: "WINDOWS/DOORS/STAIRS", sectionCode: "L20", unit: "nr", rateNgn: 150000 },
  { keyword: /window/i, section: "WINDOWS/DOORS/STAIRS", sectionCode: "L10", unit: "nr", rateNgn: 120000 },
  { keyword: /roof/i, section: "ROOF", sectionCode: "G10", unit: "m2", rateNgn: 18000 },
  { keyword: /floor|screed|finish/i, section: "FINISHES", sectionCode: "M10", unit: "m2", rateNgn: 9500 },
];

function rateFor(description: string): RateEntry | null {
  return RATE_CARD.find((r) => r.keyword.test(description)) ?? null;
}

interface Classification {
  section: string;
  sectionCode: string | null;
  unit: string;
  refinedDescription: string;
  besmmContext: string;
}

async function chatJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  if (!API_KEY) return null;
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  return content ? (JSON.parse(content) as Record<string, unknown>) : null;
}

// RAG-grounded classification: retrieve the relevant BESMM measurement rules for
// the item, then ask the LLM to assign the correct work section, code and unit
// strictly from that retrieved context (not from its own memory).
export async function classifyItem(item: TakeoffItem, index: BesmmIndex): Promise<Classification> {
  const hits = await index.search(`${item.description} ${item.trade} measurement unit work section`, 4);
  const context = hits
    .map((h, i) => `[${i + 1}] (BESMM ${h.chunk.source} p${h.chunk.page})\n${h.chunk.text}`)
    .join("\n\n");

  const result = await chatJson(
    "You are a Nigerian quantity surveyor classifying a measured construction item into the BESMM4 standard. Use ONLY the provided BESMM excerpts to choose the work section, its alphanumeric code, and the unit of measurement. Respond ONLY with strict JSON: {\"section\": string (UPPERCASE work section, e.g. SUBSTRUCTURE, MASONRY, FRAME), \"sectionCode\": string|null (e.g. F10, E10), \"unit\": string (m, m2, m3, nr, item), \"refinedDescription\": string (a proper BoQ item description), \"reasoning\": string (short)}.",
    `MEASURED ITEM:\n- description: ${item.description}\n- trade: ${item.trade}\n- quantity: ${item.quantity} ${item.unit}\n- basis: ${item.basis}\n\nBESMM EXCERPTS:\n${context}`,
  ).catch(() => null);

  if (result && typeof result["section"] === "string") {
    return {
      section: String(result["section"]).toUpperCase(),
      sectionCode: (result["sectionCode"] as string | null) ?? null,
      unit: (result["unit"] as string) || item.unit,
      refinedDescription: (result["refinedDescription"] as string) || item.description,
      besmmContext: hits.map((h) => `${h.chunk.source} p${h.chunk.page}`).join(", "),
    };
  }

  const fallback = rateFor(item.description);
  return {
    section: fallback?.section ?? "GENERAL",
    sectionCode: fallback?.sectionCode ?? null,
    unit: item.unit,
    refinedDescription: item.description,
    besmmContext: "fallback (no LLM)",
  };
}

export interface PricedLine extends BoqLine {
  besmmContext: string;
}

export async function buildBoqLines(items: TakeoffItem[], index: BesmmIndex): Promise<PricedLine[]> {
  const lines: PricedLine[] = [];
  for (const item of items) {
    const cls = await classifyItem(item, index);
    const rate = rateFor(cls.refinedDescription) ?? rateFor(item.description);
    const qty = item.quantity;
    const rateNgn = rate?.rateNgn ?? null;
    const amount = rateNgn !== null ? Math.round(qty * rateNgn) : null;
    const confidence: PricedLine["confidence"] = rateNgn !== null && cls.sectionCode ? "medium" : "low";
    lines.push({
      section: cls.section,
      sectionCode: cls.sectionCode,
      sn: null,
      description: cls.refinedDescription,
      quantity: qty,
      unit: cls.unit,
      rate: rateNgn,
      amount,
      confidence,
      provenance: `${item.basis}; BESMM: ${cls.besmmContext}; assumptions: ${item.assumptions.join("; ")}`,
      besmmContext: cls.besmmContext,
    });
  }
  return lines;
}
