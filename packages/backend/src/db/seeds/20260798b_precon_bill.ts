import type { Knex } from "knex";

// The priced bill for the Lekki duplex take-off seeded in 20260798_precon.ts.
//
// This is a bill a QS has been through, not a clean engine dump: the lines she
// could stand behind are `verified` and carry her name, the ones built up from
// a note rather than a dimension are `needs_review` with the doubt written
// down, and the struck line stays in the bill with no money against it so the
// record of the decision survives. Every amount is computed here from
// (gross − deductions) × typical × rate, so the bill cannot drift out of
// balance with its own rows.

const SESSION_ID = "pcs_seed_lekki_b";
const SESSION_R1_ID = "pcs_seed_lekki_a";
const VERIFIED_AT = "2026-09-18T16:12:00.000Z";
const RATE_CARD = "Lagos Island & Mainland 2026 Q3";

type Deduction = { label: string; qty: number; geometryId: string | null };

type RowSeed = {
  id: string;
  bill: string;
  type?: "heading" | "work_section" | "spec_note" | "item" | "provisional_sum";
  group?: string;
  code?: string;
  desc: string;
  unit?: string;
  gross?: number;
  ded?: Deduction[];
  typical?: number;
  rate?: number;
  conf?: "high" | "low";
  status?: "ai_generated" | "needs_review" | "verified" | "rejected";
  basis?: string;
  why?: string;
  from?: string;
  origin?: "ai" | "manual" | "prompt";
  edited?: string;
};

const BILLS = [
  { id: "pbl_seed_1", session_id: SESSION_ID, title: "Bill No. 1 — Preliminaries and general clauses", sort: 0 },
  { id: "pbl_seed_2", session_id: SESSION_ID, title: "Bill No. 2 — Substructure", sort: 1 },
  { id: "pbl_seed_3", session_id: SESSION_ID, title: "Bill No. 3 — Superstructure", sort: 2 },
  { id: "pbl_seed_4", session_id: SESSION_ID, title: "Bill No. 4 — Finishes", sort: 3 },
  { id: "pbl_seed_5", session_id: SESSION_ID, title: "Bill No. 5 — External works", sort: 4 },
  { id: "pbl_seed_r1", session_id: SESSION_R1_ID, title: "Bill No. 1 — Measured works (Rev A)", sort: 0 },
];

const ROWS: RowSeed[] = [
  { id: "pbr_seed_prelim_head", bill: "pbl_seed_1", type: "heading", desc: "PRELIMINARIES AND GENERAL CLAUSES" },
  { id: "pbr_seed_prelim_note", bill: "pbl_seed_1", type: "spec_note", desc: "The Articles of Agreement and the Conditions of Contract are to be read as part of these bills. Rates are to include for all labour, material, plant, waste, overheads and profit unless stated otherwise." },
  { id: "pbr_seed_prelim_site", bill: "pbl_seed_1", group: "Preliminaries", desc: "Allow for site establishment; temporary site office, store, sanitary convenience and 2.4m high hoarding to the plot boundary, maintained for the contract period and removed on completion.", unit: "item", gross: 1, rate: 2_850_000, status: "verified", basis: "Standard preliminaries clause", from: "Priced from the Lagos Island & Mainland 2026 Q3 card" },
  { id: "pbr_seed_prelim_ins", bill: "pbl_seed_1", group: "Preliminaries", desc: "Insurances: Contractor's All Risk and Public Liability cover in the joint names of the Employer and the Contractor for the contract period.", unit: "item", gross: 1, rate: 1_150_000, status: "verified", basis: "Standard preliminaries clause" },
  { id: "pbr_seed_prelim_water", bill: "pbl_seed_1", group: "Preliminaries", desc: "Allow for temporary water supply; borehole standpipe and storage for construction and testing use.", unit: "item", gross: 1, rate: 480_000, basis: "Standard preliminaries clause" },
  { id: "pbr_seed_prelim_power", bill: "pbl_seed_1", group: "Preliminaries", desc: "Allow for temporary power; 33kVA diesel generator, fuel, distribution and site lighting for the contract period.", unit: "item", gross: 1, rate: 1_620_000, basis: "Standard preliminaries clause" },
  { id: "pbr_seed_prelim_sec", bill: "pbl_seed_1", group: "Preliminaries", desc: "Allow for site security; two personnel on alternating shifts for the contract period.", unit: "item", gross: 1, rate: 2_160_000, basis: "Standard preliminaries clause" },
  { id: "pbr_seed_prelim_permit", bill: "pbl_seed_1", type: "provisional_sum", group: "Preliminaries", desc: "Provisional sum for Lagos State development permit, statutory searches and physical planning fees.", unit: "sum", gross: 1, rate: 1_500_000, status: "needs_review", conf: "low", why: "Permit fee is a Lagos State schedule figure the office has not confirmed for 2026.", basis: "Provisional; to be expended as instructed" },

  { id: "pbr_seed_sub_head", bill: "pbl_seed_2", type: "heading", desc: "SUBSTRUCTURE" },
  { id: "pbr_seed_sub_ws_exc", bill: "pbl_seed_2", type: "work_section", code: "D20", desc: "Excavating and filling" },
  { id: "pbr_seed_sub_reduce", bill: "pbl_seed_2", group: "Substructure", code: "D20.1", desc: "Excavate to reduce levels, average 300mm deep, and cart away surplus spoil to an approved tip off site.", unit: "m3", gross: 138.6, rate: 4_200, status: "verified", basis: "Measured on A-101: 462.00m² footprint × 0.30m average reduce", conf: "high" },
  { id: "pbr_seed_sub_trench", bill: "pbl_seed_2", group: "Substructure", code: "D20.2", desc: "Excavate trenches for strip foundations, width 900mm, not exceeding 1.50m deep, commencing from reduced level.", unit: "m3", gross: 96.4, rate: 5_600, status: "verified", basis: "Measured on A-101: 86.40m trench run × 0.90m wide × 1.24m deep", conf: "high" },
  { id: "pbr_seed_sub_fill", bill: "pbl_seed_2", group: "Substructure", code: "D20.3", desc: "Approved laterite filling to make up levels, deposited and compacted in 150mm layers to 95% MDD.", unit: "m3", gross: 82.5, rate: 9_800, basis: "Measured on A-301: 275.00m² oversite × 0.30m made-up depth" },
  { id: "pbr_seed_sub_termite", bill: "pbl_seed_2", group: "Substructure", code: "D20.4", desc: "Anti-termite treatment applied to trench bottoms, filled surfaces and the perimeter of the oversite.", unit: "m2", gross: 210.4, rate: 2_300, basis: "Measured on A-101: treated area to oversite and trench faces" },
  { id: "pbr_seed_sub_ws_conc", bill: "pbl_seed_2", type: "work_section", code: "E10", desc: "In-situ concrete" },
  { id: "pbr_seed_sub_blind", bill: "pbl_seed_2", group: "Substructure", code: "E10.1", desc: "Plain concrete grade 15 (1:3:6 — 20mm aggregate) in 50mm blinding to trench bottoms.", unit: "m3", gross: 6.2, rate: 128_000, status: "verified", basis: "Measured on A-501: 124.00m² trench bottom × 0.05m", conf: "high" },
  { id: "pbr_seed_sub_footing", bill: "pbl_seed_2", group: "Substructure", code: "E10.2", desc: "Reinforced concrete grade 25 (1:2:4) in strip foundation footings 900 × 225mm, including ground beams 225 × 450mm.", unit: "m3", gross: 23.8, rate: 186_000, status: "verified", basis: "Measured on A-501: footing 86.40 × 0.90 × 0.225 + ground beam", conf: "high" },
  { id: "pbr_seed_sub_slab", bill: "pbl_seed_2", group: "Substructure", code: "E10.3", desc: "Reinforced concrete grade 25 in ground floor slab 150mm thick laid on 1000 gauge polythene over compacted fill.", unit: "m3", gross: 32.2, rate: 172_000, status: "verified", basis: "Measured on A-101: 214.60m² slab area × 0.15m", conf: "high" },
  { id: "pbr_seed_sub_rebar", bill: "pbl_seed_2", group: "Substructure", code: "E30.1", desc: "High yield steel reinforcement bars to BS 4449 grade 460, cut, bent and fixed in footings, ground beams and slab, including tying wire and spacers.", unit: "kg", gross: 4_860, rate: 1_650, status: "needs_review", conf: "low", why: "Bar weights built up at 110kg/m³ from the footing detail; the set carries no bar bending schedule.", basis: "Built up from concrete volume at an assumed reinforcement ratio" },
  { id: "pbr_seed_sub_block", bill: "pbl_seed_2", group: "Substructure", code: "F10.1", desc: "225mm sandcrete block walling in cement mortar (1:6) in foundation from footing to damp proof course level.", unit: "m2", gross: 96.8, rate: 9_400, basis: "Measured on A-501: 86.40m wall run × 1.12m average height" },
  { id: "pbr_seed_sub_dpc", bill: "pbl_seed_2", group: "Substructure", code: "J40.1", desc: "Damp proof course; 1000 gauge polythene sheeting laid on blockwork and lapped 150mm at all joints and angles.", unit: "m2", gross: 24.5, rate: 1_800, status: "needs_review", conf: "low", why: "DPC width read from a note on A-501, not from a dimension.", basis: "86.40m wall run × 0.28m stated width" },

  { id: "pbr_seed_super_head", bill: "pbl_seed_3", type: "heading", desc: "SUPERSTRUCTURE" },
  { id: "pbr_seed_super_ws_frame", bill: "pbl_seed_3", type: "work_section", code: "E10", desc: "In-situ concrete — frame" },
  { id: "pbr_seed_super_col", bill: "pbl_seed_3", group: "Frame", code: "E10.4", desc: "Reinforced concrete grade 25 in columns 225 × 225mm, including formwork and propping, over two storeys.", unit: "m3", gross: 9.8, rate: 214_000, status: "verified", basis: "Measured on A-101/A-301: 24 columns × 0.225 × 0.225 × 8.06m", conf: "high" },
  { id: "pbr_seed_super_beam", bill: "pbl_seed_3", group: "Frame", code: "E10.5", desc: "Reinforced concrete grade 25 in beams 225 × 450mm at first floor and roof level, including formwork.", unit: "m3", gross: 14.6, rate: 206_000, status: "verified", basis: "Measured on A-101: 144.20m beam run × 0.225 × 0.45", conf: "high" },
  { id: "pbr_seed_super_slab", bill: "pbl_seed_3", group: "Frame", code: "E10.6", desc: "Reinforced concrete grade 25 in suspended first floor slab 150mm thick.", unit: "m3", gross: 28.4, ded: [{ label: "Stair opening", qty: 1.35, geometryId: null }], rate: 198_000, status: "verified", basis: "Measured on A-102: 189.60m² slab × 0.15m, less the stair void", conf: "high" },
  { id: "pbr_seed_super_rebar", bill: "pbl_seed_3", group: "Frame", code: "E30.2", desc: "High yield steel reinforcement bars to BS 4449 grade 460, cut, bent and fixed in columns, beams and suspended slab.", unit: "kg", gross: 6_420, rate: 1_680, status: "needs_review", conf: "low", why: "Built up at 125kg/m³ for the frame; no bar bending schedule was issued with Rev B.", basis: "Built up from frame concrete volume at an assumed reinforcement ratio" },
  { id: "pbr_seed_super_form", bill: "pbl_seed_3", group: "Frame", code: "E20.1", desc: "Sawn formwork to soffits of suspended slabs and beams, propped, struck and cleaned down.", unit: "m2", gross: 189.6, rate: 6_400, basis: "Measured on A-102: soffit area to suspended slab" },
  { id: "pbr_seed_super_ws_block", bill: "pbl_seed_3", type: "work_section", code: "F10", desc: "Block walling" },
  { id: "pbr_seed_super_block_ext", bill: "pbl_seed_3", group: "Internal and external walls", code: "F10.2", desc: "225mm sandcrete block walling in cement mortar (1:6) to external walls over two storeys, including all raking cutting and bonding to columns.", unit: "m2", gross: 268.4, ded: [{ label: "Door openings", qty: 14.6, geometryId: "pgm_seed_g4" }, { label: "Window openings", qty: 31.2, geometryId: "pgm_seed_g5" }], rate: 9_600, status: "verified", basis: "Measured on A-101/A-201: 74.55m external run × 3.60m, less openings", conf: "high", origin: "prompt", edited: "2026-09-15T10:02:41.000Z", from: "Rate reset from ₦8,900 to ₦9,600 through Panda AI after the August cement rise" },
  { id: "pbr_seed_super_block_int", bill: "pbl_seed_3", group: "Internal and external walls", code: "F10.3", desc: "150mm sandcrete block walling in cement mortar (1:6) to internal partitions.", unit: "m2", gross: 96.2, ded: [{ label: "Door openings", qty: 12.4, geometryId: null }], typical: 2, rate: 7_800, status: "verified", basis: "Ground-floor partition run measured once on A-101 × 2 typical floors", conf: "high", origin: "manual", edited: "2026-09-16T11:48:00.000Z" },
  { id: "pbr_seed_super_ws_roof", bill: "pbl_seed_3", type: "work_section", code: "G20", desc: "Roof" },
  { id: "pbr_seed_super_truss", bill: "pbl_seed_3", group: "Roof", code: "G20.1", desc: "Prefabricated treated timber roof trusses at 600mm centres to a hipped roof, including wall plates, bracing, straps and all fixings.", unit: "m2", gross: 214.8, rate: 14_500, status: "needs_review", conf: "low", why: "Pitch inferred at 30° from the section; A-103 carried no scale so the roof plan could not be measured.", basis: "Roof area derived from the A-301 section and the A-101 footprint" },
  { id: "pbr_seed_super_cover", bill: "pbl_seed_3", group: "Roof", code: "G20.2", desc: "0.55mm stone-coated aluminium long-span roofing sheets fixed to trusses, including ridge, hip cappings and valley gutters.", unit: "m2", gross: 238.4, rate: 18_200, basis: "Roof area on slope plus 300mm eaves overhang all round" },
  { id: "pbr_seed_super_fascia", bill: "pbl_seed_3", group: "Roof", code: "G20.3", desc: "150mm uPVC fascia board and 125mm half-round gutter with 75mm downpipes discharging over a channel.", unit: "m", gross: 62.4, rate: 9_400, basis: "Measured on A-201: eaves run to all elevations" },
  { id: "pbr_seed_super_ws_open", bill: "pbl_seed_3", type: "work_section", code: "L20", desc: "Doors and windows" },
  { id: "pbr_seed_super_door", bill: "pbl_seed_3", group: "Doors", code: "L20.1", desc: "Supply and fix 900 × 2100mm flush timber door on hardwood frame, including ironmongery, architrave and three coats of gloss paint.", unit: "nr", gross: 13, rate: 185_000, status: "verified", basis: "Counted from the door schedule on A-401", conf: "high" },
  { id: "pbr_seed_super_entrance", bill: "pbl_seed_3", group: "Doors", code: "L20.2", desc: "Supply and fix 1200 × 2100mm security entrance door; steel core with hardwood facing, multi-point lock and hardwood frame.", unit: "nr", gross: 1, rate: 780_000, status: "verified", basis: "Counted from the door schedule on A-401", conf: "high" },
  { id: "pbr_seed_super_window", bill: "pbl_seed_3", group: "Windows", code: "L20.3", desc: "Supply and fix 1200 × 1200mm aluminium sliding window with 6mm tinted glass, mosquito net and burglary bar.", unit: "nr", gross: 19, rate: 142_000, status: "verified", basis: "Counted from the window schedule on A-401", conf: "high" },

  { id: "pbr_seed_fin_head", bill: "pbl_seed_4", type: "heading", desc: "FINISHES" },
  { id: "pbr_seed_fin_ws_render", bill: "pbl_seed_4", type: "work_section", code: "M20", desc: "Plastered coatings" },
  { id: "pbr_seed_fin_render_int", bill: "pbl_seed_4", group: "Wall finishings", code: "M20.1", desc: "12mm cement and sand (1:4) render in one coat to internal block walls, steel trowelled to receive paint.", unit: "m2", gross: 512.8, ded: [{ label: "Door and window openings", qty: 45.8, geometryId: null }], rate: 4_200, basis: "Internal wall faces measured on A-101 and A-102, less openings" },
  { id: "pbr_seed_fin_render_ext", bill: "pbl_seed_4", group: "Wall finishings", code: "M20.2", desc: "15mm cement and sand (1:4) render in two coats to external walls, including all angles and reveals.", unit: "m2", gross: 296.4, rate: 4_800, basis: "External wall faces measured on A-201, less openings" },
  { id: "pbr_seed_fin_ws_tile", bill: "pbl_seed_4", type: "work_section", code: "M40", desc: "Tiling" },
  { id: "pbr_seed_fin_floor_tile", bill: "pbl_seed_4", group: "Floor finishings", code: "M40.1", desc: "600 × 600mm vitrified porcelain floor tiles bedded on 30mm cement screed, including skirting and grouting.", unit: "m2", gross: 148.6, rate: 26_500, status: "verified", basis: "Measured on A-101/A-102: living, dining, bedroom and lobby areas", conf: "high" },
  { id: "pbr_seed_fin_wall_tile", bill: "pbl_seed_4", group: "Wall finishings", code: "M40.2", desc: "300 × 600mm ceramic wall tiles to bathrooms and kitchen splashback, full height, bedded and grouted.", unit: "m2", gross: 86.4, rate: 22_000, status: "verified", basis: "Measured on A-101/A-102: 4 bathrooms and kitchen", conf: "high" },
  { id: "pbr_seed_fin_ws_paint", bill: "pbl_seed_4", type: "work_section", code: "M60", desc: "Painting and ceiling finishes" },
  { id: "pbr_seed_fin_paint_int", bill: "pbl_seed_4", group: "Wall finishings", code: "M60.1", desc: "Prepare and apply one coat primer and two coats emulsion paint to rendered internal walls and ceilings.", unit: "m2", gross: 612.4, rate: 2_400, basis: "Internal rendered area plus ceiling area" },
  { id: "pbr_seed_fin_paint_ext", bill: "pbl_seed_4", group: "Wall finishings", code: "M60.2", desc: "Prepare and apply weather-resistant textured paint in three coats to external rendered surfaces.", unit: "m2", gross: 296.4, rate: 3_600, basis: "External rendered area measured on A-201" },
  { id: "pbr_seed_fin_ceiling", bill: "pbl_seed_4", group: "Ceiling finishings", code: "M60.3", desc: "9mm PVC ceiling panels on 50 × 50mm treated timber noggins at 600mm centres, including cornice.", unit: "m2", gross: 214.6, rate: 11_800, basis: "Ceiling area measured on A-101 and A-102" },
  { id: "pbr_seed_fin_joinery", bill: "pbl_seed_4", type: "provisional_sum", group: "Fittings", desc: "Provisional sum for fitted kitchen units, worktop and bedroom wardrobes, to be expended as instructed.", unit: "sum", gross: 1, rate: 6_500_000, status: "needs_review", conf: "low", why: "No joinery schedule was issued; the sum is an allowance, not a measurement.", basis: "Provisional; to be expended as instructed" },

  { id: "pbr_seed_ext_head", bill: "pbl_seed_5", type: "heading", desc: "EXTERNAL WORKS" },
  { id: "pbr_seed_ext_drive", bill: "pbl_seed_5", group: "External works", code: "Q20.1", desc: "100mm reinforced concrete driveway grade 25 on 150mm compacted hardcore, bay jointed and brush finished.", unit: "m2", gross: 96.8, rate: 21_500, basis: "Measured on the A-101 site plan: driveway and turning apron" },
  { id: "pbr_seed_ext_fence", bill: "pbl_seed_5", group: "External works", code: "Q40.1", desc: "225mm sandcrete block perimeter fence wall 2.40m high on strip footing, rendered both sides and capped, including piers at 3m centres.", unit: "m", gross: 68.5, rate: 46_000, status: "verified", basis: "Measured on the A-101 site plan: boundary run less the gate opening", conf: "high" },
  { id: "pbr_seed_ext_paving", bill: "pbl_seed_5", group: "External works", code: "Q25.1", desc: "60mm precast concrete interlocking paving on 50mm sharp sand bed to walkways and parking apron.", unit: "m2", gross: 54.2, rate: 18_500, basis: "Measured on the A-101 site plan: walkways and parking" },
  { id: "pbr_seed_ext_soakaway", bill: "pbl_seed_5", group: "External works", code: "R12.1", desc: "Excavate and construct 1.20 × 1.20 × 2.00m deep soakaway pit, honeycomb block lined, with reinforced concrete cover slab.", unit: "nr", gross: 1, rate: 480_000, basis: "Counted on the A-101 site plan" },
  { id: "pbr_seed_ext_drain", bill: "pbl_seed_5", group: "External works", code: "R12.2", desc: "150mm diameter uPVC foul drain laid to falls in trench on granular bed and surround, including all bends and junctions.", unit: "m", gross: 38.6, rate: 12_400, status: "needs_review", conf: "low", why: "Drain run scaled off the site plan; no invert levels or manhole schedule shown.", basis: "Scaled on the A-101 site plan between the building and the septic tank" },
  { id: "pbr_seed_ext_lawn", bill: "pbl_seed_5", group: "External works", code: "Q30.1", desc: "Supply, spread and level 100mm approved topsoil and lay instant lawn turf to the rear garden, including first watering.", unit: "m2", gross: 120, rate: 4_500, basis: "Measured on the A-101 site plan: rear garden area" },
  // Struck by the client, not deleted: the line stays so the bill still shows
  // what was offered and withdrawn, and it carries no quantity or rate so it
  // adds nothing to the bill total.
  { id: "pbr_seed_ext_water_feature", bill: "pbl_seed_5", group: "External works", desc: "Decorative water feature to forecourt, as sketched on the site plan, including pump, sump and lighting.", unit: "item", status: "rejected", origin: "prompt", edited: "2026-09-17T14:31:22.000Z", from: "Withdrawn by the client through Panda AI on 17 Sep 2026", basis: "Sketched on the site plan; never dimensioned" },

  // Rev A measured the two floor plans only; Rev B added the elevations,
  // section and details, which is why these three figures moved.
  { id: "pbr_seed_r1_block", bill: "pbl_seed_r1", group: "Internal and external walls", code: "F10.2", desc: "225mm sandcrete block walling in cement mortar (1:6) to external walls over two storeys.", unit: "m2", gross: 254.1, rate: 8_900, status: "verified", basis: "Measured on A-101 (Rev A): 70.58m external run × 3.60m", conf: "high" },
  { id: "pbr_seed_r1_roof", bill: "pbl_seed_r1", group: "Roof", code: "G20.1", desc: "Prefabricated treated timber roof trusses at 600mm centres, including wall plates and bracing.", unit: "m2", gross: 202.3, rate: 14_500, status: "needs_review", conf: "low", why: "Rev A carried no section, so the roof was taken as the footprint with no pitch allowance.", basis: "Footprint on A-101 (Rev A)" },
  { id: "pbr_seed_r1_slab", bill: "pbl_seed_r1", group: "Substructure", code: "E10.3", desc: "Reinforced concrete grade 25 in ground floor slab 150mm thick.", unit: "m3", gross: 30.1, rate: 172_000, status: "verified", basis: "Measured on A-101 (Rev A): 200.67m² slab area × 0.15m", conf: "high" },
];

type GeometrySeed = { id: string; row: string; sheet: string; kind: string; qty: number; unit: string; source: "ai" | "manual"; vertices: number[][] };

// Vertices are PDF user-space points on the sheet they were drawn on; the
// quantity is the drawn figure, which the row then factors into its own unit.
const GEOMETRIES: GeometrySeed[] = [
  { id: "pgm_seed_g1", row: "pbr_seed_sub_trench", sheet: "psh_seed_1", kind: "linear", qty: 86.4, unit: "m", source: "ai", vertices: [[96, 148], [452, 148], [452, 396], [96, 396], [96, 148]] },
  { id: "pgm_seed_g2", row: "pbr_seed_sub_slab", sheet: "psh_seed_1", kind: "area", qty: 214.6, unit: "m2", source: "ai", vertices: [[102, 154], [446, 154], [446, 390], [102, 390], [102, 154]] },
  { id: "pgm_seed_g3", row: "pbr_seed_super_block_ext", sheet: "psh_seed_1", kind: "linear", qty: 74.55, unit: "m", source: "ai", vertices: [[100, 152], [448, 152], [448, 392], [100, 392], [100, 152]] },
  { id: "pgm_seed_g4", row: "pbr_seed_super_block_ext", sheet: "psh_seed_1", kind: "deduction", qty: 14.6, unit: "m2", source: "manual", vertices: [[212, 152], [268, 152], [268, 160], [212, 160], [212, 152]] },
  { id: "pgm_seed_g5", row: "pbr_seed_super_block_ext", sheet: "psh_seed_4", kind: "deduction", qty: 31.2, unit: "m2", source: "manual", vertices: [[144, 208], [196, 208], [196, 252], [144, 252], [144, 208]] },
  { id: "pgm_seed_g6", row: "pbr_seed_super_block_int", sheet: "psh_seed_1", kind: "linear", qty: 26.72, unit: "m", source: "manual", vertices: [[168, 154], [168, 392], [312, 392], [312, 260]] },
  { id: "pgm_seed_g7", row: "pbr_seed_super_cover", sheet: "psh_seed_5", kind: "area", qty: 238.4, unit: "m2", source: "ai", vertices: [[88, 116], [472, 116], [472, 188], [88, 188], [88, 116]] },
  { id: "pgm_seed_g8", row: "pbr_seed_super_door", sheet: "psh_seed_1", kind: "count", qty: 13, unit: "nr", source: "manual", vertices: [[214, 156], [246, 218], [318, 218], [356, 292], [204, 330], [268, 372], [332, 372], [156, 244], [402, 244], [402, 330], [230, 264], [292, 156], [368, 156]] },
  { id: "pgm_seed_g9", row: "pbr_seed_ext_fence", sheet: "psh_seed_1", kind: "linear", qty: 68.5, unit: "m", source: "ai", vertices: [[62, 104], [492, 104], [492, 440], [62, 440], [62, 104]] },
  { id: "pgm_seed_g10", row: "pbr_seed_fin_floor_tile", sheet: "psh_seed_2", kind: "area", qty: 148.6, unit: "m2", source: "ai", vertices: [[110, 160], [438, 160], [438, 384], [110, 384], [110, 160]] },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function seed(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("precon_bills"))) return;
  // The sessions seed skips itself when there is no organisation yet; without
  // a session there is nothing to bill.
  const sessions = await knex("precon_sessions").whereIn("id", [SESSION_ID, SESSION_R1_ID]).pluck<string[]>("id");
  if (sessions.length === 0) return;

  const verifier = await knex("user").orderBy("createdAt", "asc").first<{ id: string }>("id");
  const hasGeometries = await knex.schema.hasTable("precon_geometries");

  if (hasGeometries) await knex("precon_geometries").where("id", "like", "pgm_seed_%").del();
  await knex("precon_boq_rows").where("id", "like", "pbr_seed_%").del();
  await knex("precon_bills").where("id", "like", "pbl_seed_%").del();

  const bills = BILLS.filter((bill) => sessions.includes(bill.session_id));
  await knex("precon_bills").insert(bills.map((bill) => ({ ...bill, created_at: "2026-09-08T09:25:00.000Z" })));

  const billIds = new Set(bills.map((bill) => bill.id));
  const sortByBill = new Map<string, number>();

  const rows = ROWS.filter((row) => billIds.has(row.bill)).map((row) => {
    const sort = sortByBill.get(row.bill) ?? 0;
    sortByBill.set(row.bill, sort + 1);
    const priced = row.gross !== undefined && row.rate !== undefined;
    const deducted = (row.ded ?? []).reduce((total, entry) => total + entry.qty, 0);
    const qty = priced ? round2((row.gross! - deducted) * (row.typical ?? 1)) : null;
    const amount = qty === null ? null : round2(qty * row.rate!);
    const status = row.status ?? (priced ? "ai_generated" : null);
    const verified = status === "verified";
    return {
      id: row.id,
      bill_id: row.bill,
      sort,
      row_type: row.type ?? "item",
      element_group: row.group ?? null,
      code: row.code ?? null,
      description: row.desc,
      unit: row.unit ?? null,
      qty_gross: row.gross === undefined ? null : row.gross.toFixed(2),
      deductions: JSON.stringify(row.ded ?? []),
      typical: row.typical ?? 1,
      qty: qty === null ? null : qty.toFixed(2),
      rate: row.rate === undefined ? null : row.rate.toFixed(2),
      amount: amount === null ? null : amount.toFixed(2),
      rate_source: row.rate === undefined ? null : RATE_CARD,
      confidence: row.conf ?? (priced ? "high" : null),
      status,
      version: row.edited ? 2 : 1,
      measurement_basis: row.basis ?? null,
      confidence_reason: row.why ?? null,
      provenance: row.from ?? null,
      origin: row.origin ?? "ai",
      evidence: null,
      edited_at: row.edited ?? null,
      edited_by: row.edited ? "seed-eng" : null,
      verified_by: verified ? (verifier?.id ?? null) : null,
      verified_at: verified ? VERIFIED_AT : null,
      created_at: "2026-09-08T09:25:00.000Z",
      updated_at: row.edited ?? "2026-09-18T16:12:00.000Z",
    };
  });
  await knex("precon_boq_rows").insert(rows);

  if (!hasGeometries) return;
  const rowIds = new Set(rows.map((row) => row.id));
  const sheetIds = await knex("precon_sheets").where("id", "like", "psh_seed_%").pluck<string[]>("id");
  const drawn = GEOMETRIES.filter((geo) => rowIds.has(geo.row) && sheetIds.includes(geo.sheet));
  if (drawn.length === 0) return;
  await knex("precon_geometries").insert(
    drawn.map((geo) => ({
      id: geo.id,
      row_id: geo.row,
      sheet_id: geo.sheet,
      kind: geo.kind,
      vertices: JSON.stringify(geo.vertices),
      source: geo.source,
      quantity: geo.qty.toFixed(2),
      unit: geo.unit,
      created_at: "2026-09-08T09:22:00.000Z",
    })),
  );
}
