import type { WorkSection } from "./types";

/** NRM2 work sections for a building job, with the unit each is measured in. */
export const BUILDING_WORK_SECTIONS: WorkSection[] = [
  {
    code: "5",
    group: "Excavating & filling",
    items: [
      { name: "Site clearance", type: "site_clearance", unit: "m²" },
      { name: "Bulk excavation", type: "bulk_excavation", unit: "m³" },
      { name: "Foundation excavation", type: "foundation_excavation", unit: "m³" },
      { name: "Filling & compaction", type: "filling_compaction", unit: "m³" },
      { name: "Disposal of excavated material", type: "disposal_excavated", unit: "m³" },
    ],
  },
  {
    code: "11",
    group: "In-situ concrete works",
    items: [
      { name: "Blinding concrete", type: "blinding_concrete", unit: "m²" },
      { name: "Foundation concrete pour", type: "foundation_concrete", unit: "m³" },
      { name: "Reinforcement fixing", type: "reinforcement_fixing", unit: "tonne" },
      { name: "Formwork to slab", type: "formwork_slab", unit: "m²" },
      { name: "Suspended slab pour", type: "suspended_slab", unit: "m³" },
      { name: "Column & beam concrete", type: "column_beam_concrete", unit: "m³" },
    ],
  },
  {
    code: "12",
    group: "Precast / composite concrete",
    items: [
      { name: "Precast plank installation", type: "precast_plank", unit: "m²" },
      { name: "Precast stair installation", type: "precast_stair", unit: "number" },
    ],
  },
  {
    code: "14",
    group: "Masonry",
    items: [
      { name: "Blockwork to external walls", type: "blockwork_external", unit: "m²" },
      { name: "Blockwork to internal walls", type: "blockwork_internal", unit: "m²" },
      { name: "Brickwork facing", type: "brickwork_facing", unit: "m²" },
      { name: "Damp-proof course", type: "damp_proof_course", unit: "m" },
    ],
  },
  {
    code: "16",
    group: "Structural metalwork",
    items: [
      { name: "Steel frame erection", type: "steel_frame_erection", unit: "tonne" },
      { name: "Steel connections & bolting", type: "steel_connections", unit: "number" },
    ],
  },
  {
    code: "17",
    group: "Carpentry",
    items: [
      { name: "Timber floor joists", type: "timber_floor_joists", unit: "m" },
      { name: "Roof carcass / trusses", type: "roof_carcass", unit: "m²" },
      { name: "First-fix carpentry", type: "first_fix_carpentry", unit: "m²" },
    ],
  },
  {
    code: "18",
    group: "Roofing & cladding",
    items: [
      { name: "Roof covering installation", type: "roof_covering", unit: "m²" },
      { name: "Waterproofing & felt", type: "roof_waterproofing", unit: "m²" },
      { name: "Rainwater goods", type: "rainwater_goods", unit: "m" },
      { name: "Wall cladding", type: "wall_cladding", unit: "m²" },
    ],
  },
  {
    code: "20",
    group: "Doors, windows & glazing",
    items: [
      { name: "Window installation", type: "window_installation", unit: "number" },
      { name: "External door installation", type: "external_door", unit: "number" },
      { name: "Internal door hanging", type: "internal_door", unit: "number" },
      { name: "Glazing & curtain walling", type: "glazing", unit: "m²" },
    ],
  },
  {
    code: "22",
    group: "General joinery",
    items: [
      { name: "Second-fix joinery", type: "second_fix_joinery", unit: "number" },
      { name: "Skirtings & architraves", type: "skirtings_architraves", unit: "m" },
      { name: "Fitted units & worktops", type: "fitted_units", unit: "m" },
    ],
  },
  {
    code: "28",
    group: "Floor, wall & ceiling finishes",
    items: [
      { name: "Floor screed", type: "floor_screed", unit: "m²" },
      { name: "Wall plastering", type: "wall_plastering", unit: "m²" },
      { name: "Ceiling / suspended ceiling", type: "ceiling_finish", unit: "m²" },
      { name: "Floor tiling", type: "floor_tiling", unit: "m²" },
      { name: "Wall tiling", type: "wall_tiling", unit: "m²" },
    ],
  },
  {
    code: "29",
    group: "Decoration",
    items: [
      { name: "Internal painting", type: "internal_painting", unit: "m²" },
      { name: "External painting", type: "external_painting", unit: "m²" },
    ],
  },
  {
    code: "33",
    group: "Drainage below ground",
    items: [
      { name: "Foul drainage runs", type: "foul_drainage", unit: "m" },
      { name: "Surface-water drainage", type: "surface_drainage", unit: "m" },
      { name: "Manholes & inspection chambers", type: "manholes", unit: "number" },
      { name: "Soakaway construction", type: "soakaway", unit: "number" },
    ],
  },
  {
    code: "34",
    group: "Site works & external",
    items: [
      { name: "Hardstanding & paving", type: "paving", unit: "m²" },
      { name: "Kerbs & edgings", type: "kerbs_edgings", unit: "m" },
      { name: "Boundary walls & fencing", type: "boundary_fencing", unit: "m" },
      { name: "Landscaping & planting", type: "landscaping", unit: "m²" },
    ],
  },
  {
    code: "37",
    group: "Mechanical services",
    items: [
      { name: "Cold & hot water installation", type: "water_installation", unit: "number" },
      { name: "Sanitaryware installation", type: "sanitaryware", unit: "number" },
      { name: "Heating / HVAC installation", type: "hvac_installation", unit: "number" },
      { name: "Mechanical first fix", type: "mechanical_first_fix", unit: "m" },
    ],
  },
  {
    code: "38",
    group: "Electrical services",
    items: [
      { name: "Electrical first fix", type: "electrical_first_fix", unit: "number" },
      { name: "Electrical second fix", type: "electrical_second_fix", unit: "number" },
      { name: "Distribution board & testing", type: "electrical_testing", unit: "number" },
      { name: "Lighting installation", type: "lighting_installation", unit: "number" },
    ],
  },
  {
    code: "41",
    group: "Testing, commissioning & handover",
    items: [
      { name: "Snagging & remedial works", type: "snagging", unit: "sum" },
      { name: "Services commissioning", type: "commissioning", unit: "sum" },
      { name: "Final clean", type: "final_clean", unit: "m²" },
      { name: "Handover & as-built records", type: "handover", unit: "sum" },
    ],
  },
];
