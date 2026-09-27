import type { Knex } from "knex";

// The organisation's pre-construction library: rate cards, the build-ups
// behind the headline rates, the supplier quotes those build-ups came from,
// standard assemblies and the compliance pack.
//
// None of it belongs to a take-off — it is the estimator's own reference, so
// every bid prices the same way. It is scoped to the organisation, so this
// seed skips itself entirely until one exists.

const CARD_LAGOS = "prc_seed_lagos";
const CARD_LABOUR = "prc_seed_labour";

type RateSeed = { id: string; card: string; label: string; prefix: string; pattern: string; unit: string; rate: number };

const RATES: RateSeed[] = [
  { id: "prt_seed_block225", card: CARD_LAGOS, label: "225mm sandcrete block walling in mortar (1:6)", prefix: "F10", pattern: "225mm sandcrete block", unit: "m2", rate: 9_600 },
  { id: "prt_seed_block150", card: CARD_LAGOS, label: "150mm sandcrete block walling in mortar (1:6)", prefix: "F10", pattern: "150mm sandcrete block", unit: "m2", rate: 7_800 },
  { id: "prt_seed_conc25", card: CARD_LAGOS, label: "Reinforced concrete grade 25 (1:2:4)", prefix: "E10", pattern: "grade 25", unit: "m3", rate: 186_000 },
  { id: "prt_seed_conc15", card: CARD_LAGOS, label: "Plain concrete grade 15 (1:3:6) in blinding", prefix: "E10", pattern: "grade 15", unit: "m3", rate: 128_000 },
  { id: "prt_seed_rebar", card: CARD_LAGOS, label: "High yield reinforcement, cut, bent and fixed", prefix: "E30", pattern: "reinforcement", unit: "kg", rate: 1_650 },
  { id: "prt_seed_form", card: CARD_LAGOS, label: "Sawn formwork to soffits, propped", prefix: "E20", pattern: "formwork", unit: "m2", rate: 6_400 },
  { id: "prt_seed_exc", card: CARD_LAGOS, label: "Excavate trenches not exceeding 1.50m deep", prefix: "D20", pattern: "excavate trench", unit: "m3", rate: 5_600 },
  { id: "prt_seed_render", card: CARD_LAGOS, label: "12mm cement and sand (1:4) render", prefix: "M20", pattern: "render", unit: "m2", rate: 4_200 },
  { id: "prt_seed_tile", card: CARD_LAGOS, label: "600 × 600mm porcelain floor tiling on screed", prefix: "M40", pattern: "porcelain floor tile", unit: "m2", rate: 26_500 },
  { id: "prt_seed_paint", card: CARD_LAGOS, label: "Emulsion paint, primer and two coats", prefix: "M60", pattern: "emulsion paint", unit: "m2", rate: 2_400 },
  { id: "prt_seed_roof", card: CARD_LAGOS, label: "0.55mm stone-coated aluminium roofing sheets", prefix: "G20", pattern: "long-span roofing", unit: "m2", rate: 18_200 },
  { id: "prt_seed_dpc", card: CARD_LAGOS, label: "1000 gauge polythene damp proof course", prefix: "J40", pattern: "damp proof course", unit: "m2", rate: 1_800 },
  { id: "prt_seed_lab_block", card: CARD_LABOUR, label: "Blocklaying, labour only, 225mm walls", prefix: "F10", pattern: "225mm sandcrete block", unit: "m2", rate: 2_600 },
  { id: "prt_seed_lab_render", card: CARD_LABOUR, label: "Rendering, labour only", prefix: "M20", pattern: "render", unit: "m2", rate: 1_400 },
];

type BuildupSeed = { id: string; rate: string; component: string; desc: string; qty: number; unit: string; cost: number; waste?: number };

// Each build-up sums to the published rate: block wall 8,856.20 of cost plus
// 743.80 overhead = 9,600.00/m²; grade 25 concrete 169,780 plus 16,220 =
// 186,000/m³. Overhead is carried as a line rather than a percentage because
// the table prices components, not margins.
const BUILDUPS: BuildupSeed[] = [
  { id: "prb_seed_blk_1", rate: "prt_seed_block225", component: "material", desc: "450 × 225 × 225mm vibrated sandcrete block, 10 per m²", qty: 10, unit: "nr", cost: 590, waste: 5 },
  { id: "prb_seed_blk_2", rate: "prt_seed_block225", component: "material", desc: "Cement for mortar and jointing (1:6)", qty: 0.12, unit: "bag", cost: 9_500, waste: 3 },
  { id: "prb_seed_blk_3", rate: "prt_seed_block225", component: "material", desc: "Sharp sand for mortar", qty: 0.03, unit: "m3", cost: 18_000, waste: 5 },
  { id: "prb_seed_blk_4", rate: "prt_seed_block225", component: "labour", desc: "Mason and labourer gang", qty: 0.4, unit: "hr", cost: 1_900 },
  { id: "prb_seed_blk_5", rate: "prt_seed_block225", component: "plant", desc: "Mixer, hoist and scaffold allocation", qty: 1, unit: "item", cost: 160 },
  { id: "prb_seed_blk_6", rate: "prt_seed_block225", component: "overhead", desc: "Site overhead and profit", qty: 1, unit: "item", cost: 743.8 },
  { id: "prb_seed_c25_1", rate: "prt_seed_conc25", component: "material", desc: "Cement, 6.4 bags per m³ at a 1:2:4 mix", qty: 6.4, unit: "bag", cost: 9_500, waste: 2 },
  { id: "prb_seed_c25_2", rate: "prt_seed_conc25", component: "material", desc: "Sharp sand", qty: 0.44, unit: "m3", cost: 18_000, waste: 5 },
  { id: "prb_seed_c25_3", rate: "prt_seed_conc25", component: "material", desc: "20mm granite chippings", qty: 0.88, unit: "m3", cost: 52_000, waste: 5 },
  { id: "prb_seed_c25_4", rate: "prt_seed_conc25", component: "material", desc: "Water, admixture and curing compound", qty: 1, unit: "item", cost: 1_800 },
  { id: "prb_seed_c25_5", rate: "prt_seed_conc25", component: "labour", desc: "Concrete gang: batching, placing and finishing", qty: 3.2, unit: "hr", cost: 2_000 },
  { id: "prb_seed_c25_6", rate: "prt_seed_conc25", component: "plant", desc: "Mixer, poker vibrator and fuel", qty: 1, unit: "item", cost: 7_200 },
  { id: "prb_seed_c25_7", rate: "prt_seed_conc25", component: "subcontract", desc: "Formwork and propping, supplied and fixed", qty: 1, unit: "item", cost: 36_000 },
  { id: "prb_seed_c25_8", rate: "prt_seed_conc25", component: "overhead", desc: "Site overhead and profit", qty: 1, unit: "item", cost: 16_220 },
];

type QuoteSeed = { id: string; rate: string | null; supplier: string; ref: string; until: string | null; amount: number; unit: string; notes: string };

const QUOTES: QuoteSeed[] = [
  { id: "pqs_seed_blocks", rate: "prt_seed_block225", supplier: "Ogudu Blocks & Aggregates Ltd", ref: "OBA/Q/2026/0418", until: "2026-11-30", amount: 590, unit: "nr", notes: "Ex-factory for 450 × 225 × 225mm vibrated blocks. Delivery to Lekki Phase 1 quoted separately at ₦48,000 per 500-block trip." },
  { id: "pqs_seed_cement", rate: null, supplier: "Dangote Cement Plc — Ikeja depot", ref: "DCP/LAG/26-Q3/1187", until: "2026-10-15", amount: 9_500, unit: "bag", notes: "3X 42.5R collected at depot. The depot reprices on a monthly circular, so this is not a held price." },
  { id: "pqs_seed_granite", rate: "prt_seed_conc25", supplier: "Ratcon Quarries Nigeria Ltd", ref: "RQN-2026-2290", until: "2026-12-31", amount: 52_000, unit: "m3", notes: "20mm granite chippings delivered to site in 20-tonne loads." },
  // Lapses inside the 30-day window the library treats as expiring, so the
  // rate library shows a warning without the quote being dead yet.
  { id: "pqs_seed_roof", rate: "prt_seed_roof", supplier: "Alucoat Roofing Systems Ltd", ref: "ARS/Q/1104", until: "2026-09-30", amount: 18_200, unit: "m2", notes: "Stone-coated bond profile, 0.55mm, supplied and fixed including ridge and hip cappings." },
  // Already lapsed: the reinforcement line in the bill is priced off a quote
  // that has to be renewed before the tender goes out.
  { id: "pqs_seed_rebar", rate: "prt_seed_rebar", supplier: "Premier Steel Mills Ltd", ref: "PSM/26/0072", until: "2026-08-31", amount: 1_650, unit: "kg", notes: "Y12 to Y16 grade 460 at mill gate. Expired — re-quote before the tender is submitted." },
];

type AssemblySeed = { id: string; name: string; unit: string; group: string; items: { description: string; unit: string; factor: number; elementGroup: string; rateId: string | null; code: string | null }[] };

// One drawn quantity, several billed items. A wall measured once should always
// produce the same five lines, whoever measured it.
const ASSEMBLIES: AssemblySeed[] = [
  {
    id: "pas_seed_ext_wall", name: "External wall — 225mm block, rendered and painted both faces", unit: "m2", group: "Internal and external walls",
    items: [
      { description: "225mm sandcrete block walling in cement mortar (1:6)", unit: "m2", factor: 1, elementGroup: "Internal and external walls", rateId: "prt_seed_block225", code: "F10.2" },
      { description: "12mm cement and sand (1:4) render to internal face", unit: "m2", factor: 1, elementGroup: "Wall finishings", rateId: "prt_seed_render", code: "M20.1" },
      { description: "15mm cement and sand (1:4) render in two coats to external face", unit: "m2", factor: 1, elementGroup: "Wall finishings", rateId: "prt_seed_render", code: "M20.2" },
      { description: "Emulsion paint, primer and two coats, to internal face", unit: "m2", factor: 1, elementGroup: "Wall finishings", rateId: "prt_seed_paint", code: "M60.1" },
      { description: "Weather-resistant textured paint, three coats, to external face", unit: "m2", factor: 1, elementGroup: "Wall finishings", rateId: null, code: "M60.2" },
    ],
  },
  {
    id: "pas_seed_partition", name: "Internal partition — 150mm block, rendered and painted both faces", unit: "m2", group: "Internal and external walls",
    items: [
      { description: "150mm sandcrete block walling in cement mortar (1:6)", unit: "m2", factor: 1, elementGroup: "Internal and external walls", rateId: "prt_seed_block150", code: "F10.3" },
      { description: "12mm cement and sand (1:4) render to both faces", unit: "m2", factor: 2, elementGroup: "Wall finishings", rateId: "prt_seed_render", code: "M20.1" },
      { description: "Emulsion paint, primer and two coats, to both faces", unit: "m2", factor: 2, elementGroup: "Wall finishings", rateId: "prt_seed_paint", code: "M60.1" },
    ],
  },
  {
    // Factors are the 900 × 225mm footing with a 1.24m dig on the A-501
    // detail, so a metre of wall run prices its whole foundation.
    id: "pas_seed_strip_fdn", name: "Strip foundation per metre run — 900 × 225mm footing, 1.24m dig", unit: "m", group: "Substructure",
    items: [
      { description: "Excavate trench not exceeding 1.50m deep and cart away", unit: "m3", factor: 1.116, elementGroup: "Substructure", rateId: "prt_seed_exc", code: "D20.2" },
      { description: "Plain concrete grade 15 in 50mm blinding", unit: "m3", factor: 0.045, elementGroup: "Substructure", rateId: "prt_seed_conc15", code: "E10.1" },
      { description: "Reinforced concrete grade 25 in footing", unit: "m3", factor: 0.203, elementGroup: "Substructure", rateId: "prt_seed_conc25", code: "E10.2" },
      { description: "High yield reinforcement, cut, bent and fixed", unit: "kg", factor: 22.3, elementGroup: "Substructure", rateId: "prt_seed_rebar", code: "E30.1" },
      { description: "225mm block walling from footing to DPC", unit: "m2", factor: 1.12, elementGroup: "Substructure", rateId: "prt_seed_block225", code: "F10.1" },
      { description: "1000 gauge polythene damp proof course", unit: "m2", factor: 0.28, elementGroup: "Substructure", rateId: "prt_seed_dpc", code: "J40.1" },
    ],
  },
  {
    id: "pas_seed_susp_slab", name: "Suspended slab per square metre — 150mm, propped", unit: "m2", group: "Frame",
    items: [
      { description: "Reinforced concrete grade 25 in suspended slab", unit: "m3", factor: 0.15, elementGroup: "Frame", rateId: "prt_seed_conc25", code: "E10.6" },
      { description: "Sawn formwork to soffit, propped and struck", unit: "m2", factor: 1, elementGroup: "Frame", rateId: "prt_seed_form", code: "E20.1" },
      { description: "High yield reinforcement, cut, bent and fixed", unit: "kg", factor: 18.75, elementGroup: "Frame", rateId: "prt_seed_rebar", code: "E30.2" },
    ],
  },
];

type DocSeed = { id: string; file: string; type: string; expiry: string | null; ref: string; notes: string | null };

const DOCS: DocSeed[] = [
  { id: "pcd_seed_car", file: "CAR-Policy-Leadway-2026.pdf", type: "insurance_car", expiry: "2027-03-31", ref: "LEAD/CAR/26/44821", notes: "Contractor's All Risk, ₦250m limit, joint names with the Employer." },
  { id: "pcd_seed_pl", file: "Public-Liability-AIICO-2026.pdf", type: "insurance_public_liability", expiry: "2027-01-15", ref: "AIICO/PL/26/1902", notes: "₦100m any one occurrence, unlimited in the period." },
  { id: "pcd_seed_tcc", file: "Tax-Clearance-Certificate-2025.pdf", type: "tax_clearance", expiry: "2026-12-31", ref: "LIRS/TCC/2025/338211", notes: "Three-year clearance; most Lagos tenders ask for it." },
  { id: "pcd_seed_cac", file: "CAC-Certificate-of-Incorporation.pdf", type: "cac", expiry: null, ref: "RC 1442089", notes: "Incorporation certificate does not expire; the annual return does." },
  { id: "pcd_seed_bond", file: "Performance-Bond-Draft-Lekki.pdf", type: "performance_bond", expiry: "2027-06-30", ref: "FBN/BOND/26/0771", notes: "Draft wording from the bank; not issued until the contract is signed." },
  // Inside the expiry warning window, which is the point of tracking it.
  { id: "pcd_seed_apg", file: "Advance-Payment-Guarantee-Lekki.pdf", type: "advance_payment_guarantee", expiry: "2026-10-20", ref: "FBN/APG/26/0812", notes: "Covers the 15% advance; lapses before the programmed start." },
  { id: "pcd_seed_iso", file: "ISO-45001-Certificate.pdf", type: "other", expiry: "2027-08-01", ref: "BV/45001/NG/2024/1187", notes: "Occupational health and safety certification." },
];

export async function seed(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("precon_rate_cards"))) return;
  const org = await knex("organization")
    .where("id", "not like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  if (!org) return;

  const uploader = await knex("user").orderBy("createdAt", "asc").first<{ id: string }>("id");
  const hasQuotes = await knex.schema.hasTable("precon_quote_sources");
  const hasBuildups = await knex.schema.hasTable("precon_rate_buildups");

  if (hasQuotes) await knex("precon_quote_sources").where("id", "like", "pqs_seed_%").del();
  if (hasBuildups) await knex("precon_rate_buildups").where("id", "like", "prb_seed_%").del();
  await knex("precon_rates").where("id", "like", "prt_seed_%").del();
  await knex("precon_rate_cards").where("id", "like", "prc_seed_%").del();

  await knex("precon_rate_cards").insert([
    { id: CARD_LAGOS, org_id: org.id, name: "Lagos Island & Mainland 2026 Q3", region: "Lagos", currency: "NGN", is_default: true, created_at: "2026-07-01T08:00:00.000Z" },
    // Labour-only rates are what a build under a supply-by-client arrangement
    // is priced from; keeping them on a second card stops them being matched
    // against a full-contract bill by accident.
    { id: CARD_LABOUR, org_id: org.id, name: "Labour-only rates 2026", region: "Lagos", currency: "NGN", is_default: false, created_at: "2026-07-01T08:05:00.000Z" },
  ]);

  await knex("precon_rates").insert(
    RATES.map((rate) => ({
      id: rate.id,
      rate_card_id: rate.card,
      label: rate.label,
      code_prefix: rate.prefix,
      description_pattern: rate.pattern,
      unit: rate.unit,
      rate: rate.rate.toFixed(2),
      created_at: "2026-07-01T08:10:00.000Z",
    })),
  );

  if (hasBuildups) {
    await knex("precon_rate_buildups").insert(
      BUILDUPS.map((buildup, index) => ({
        id: buildup.id,
        rate_id: buildup.rate,
        component: buildup.component,
        description: buildup.desc,
        qty: buildup.qty.toFixed(3),
        unit: buildup.unit,
        unit_cost: buildup.cost.toFixed(2),
        waste_pct: (buildup.waste ?? 0).toFixed(2),
        sort: index,
        created_at: "2026-07-01T08:15:00.000Z",
      })),
    );
  }

  if (hasQuotes) {
    await knex("precon_quote_sources").insert(
      QUOTES.map((quote) => ({
        id: quote.id,
        org_id: org.id,
        rate_id: quote.rate,
        supplier_name: quote.supplier,
        reference: quote.ref,
        valid_until: quote.until,
        // No quote PDF is uploaded by the seed, so the row carries the figure
        // and the reference without a file behind it.
        file_id: null,
        amount: quote.amount.toFixed(2),
        unit: quote.unit,
        notes: quote.notes,
        created_by: uploader?.id ?? null,
        created_at: "2026-07-04T09:30:00.000Z",
      })),
    );
  }

  if (await knex.schema.hasTable("precon_assemblies")) {
    await knex("precon_assemblies").where("id", "like", "pas_seed_%").del();
    await knex("precon_assemblies").insert(
      ASSEMBLIES.map((assembly) => ({
        id: assembly.id,
        org_id: org.id,
        name: assembly.name,
        unit: assembly.unit,
        element_group: assembly.group,
        items: JSON.stringify(assembly.items),
        created_by: "seed-eng",
        created_at: "2026-07-08T10:00:00.000Z",
        updated_at: "2026-09-02T11:20:00.000Z",
      })),
    );
  }

  if (await knex.schema.hasTable("precon_compliance_docs")) {
    await knex("precon_compliance_docs").where("id", "like", "pcd_seed_%").del();
    await knex("precon_compliance_docs").insert(
      DOCS.map((doc) => ({
        id: doc.id,
        org_id: org.id,
        file_name: doc.file,
        storage_path: `compliance/seed/${doc.file}`,
        doc_type: doc.type,
        expiry_date: doc.expiry,
        reference: doc.ref,
        notes: doc.notes,
        file_id: null,
        uploaded_by: uploader?.id ?? null,
        expiring_notified_at: null,
        expired_notified_at: null,
        created_at: "2026-07-10T12:00:00.000Z",
      })),
    );
  }
}
