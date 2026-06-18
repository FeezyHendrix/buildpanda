export interface NrmWorkItem {
  name: string;
  type: string;
}

export interface NrmWorkSection {
  code: string;
  group: string;
  items: NrmWorkItem[];
}

export const NRM_WORK_SECTIONS: NrmWorkSection[] = [
  {
    code: "5",
    group: "Excavating & filling",
    items: [
      { name: "Site clearance", type: "site_clearance" },
      { name: "Bulk excavation", type: "bulk_excavation" },
      { name: "Foundation excavation", type: "foundation_excavation" },
      { name: "Filling & compaction", type: "filling_compaction" },
      { name: "Disposal of excavated material", type: "disposal_excavated" },
    ],
  },
  {
    code: "11",
    group: "In-situ concrete works",
    items: [
      { name: "Blinding concrete", type: "blinding_concrete" },
      { name: "Foundation concrete pour", type: "foundation_concrete" },
      { name: "Reinforcement fixing", type: "reinforcement_fixing" },
      { name: "Formwork to slab", type: "formwork_slab" },
      { name: "Suspended slab pour", type: "suspended_slab" },
      { name: "Column & beam concrete", type: "column_beam_concrete" },
    ],
  },
  {
    code: "12",
    group: "Precast / composite concrete",
    items: [
      { name: "Precast plank installation", type: "precast_plank" },
      { name: "Precast stair installation", type: "precast_stair" },
    ],
  },
  {
    code: "14",
    group: "Masonry",
    items: [
      { name: "Blockwork to external walls", type: "blockwork_external" },
      { name: "Blockwork to internal walls", type: "blockwork_internal" },
      { name: "Brickwork facing", type: "brickwork_facing" },
      { name: "Damp-proof course", type: "damp_proof_course" },
    ],
  },
  {
    code: "16",
    group: "Structural metalwork",
    items: [
      { name: "Steel frame erection", type: "steel_frame_erection" },
      { name: "Steel connections & bolting", type: "steel_connections" },
    ],
  },
  {
    code: "17",
    group: "Carpentry",
    items: [
      { name: "Timber floor joists", type: "timber_floor_joists" },
      { name: "Roof carcass / trusses", type: "roof_carcass" },
      { name: "First-fix carpentry", type: "first_fix_carpentry" },
    ],
  },
  {
    code: "18",
    group: "Roofing & cladding",
    items: [
      { name: "Roof covering installation", type: "roof_covering" },
      { name: "Waterproofing & felt", type: "roof_waterproofing" },
      { name: "Rainwater goods", type: "rainwater_goods" },
      { name: "Wall cladding", type: "wall_cladding" },
    ],
  },
  {
    code: "20",
    group: "Doors, windows & glazing",
    items: [
      { name: "Window installation", type: "window_installation" },
      { name: "External door installation", type: "external_door" },
      { name: "Internal door hanging", type: "internal_door" },
      { name: "Glazing & curtain walling", type: "glazing" },
    ],
  },
  {
    code: "22",
    group: "General joinery",
    items: [
      { name: "Second-fix joinery", type: "second_fix_joinery" },
      { name: "Skirtings & architraves", type: "skirtings_architraves" },
      { name: "Fitted units & worktops", type: "fitted_units" },
    ],
  },
  {
    code: "28",
    group: "Floor, wall & ceiling finishes",
    items: [
      { name: "Floor screed", type: "floor_screed" },
      { name: "Wall plastering", type: "wall_plastering" },
      { name: "Ceiling / suspended ceiling", type: "ceiling_finish" },
      { name: "Floor tiling", type: "floor_tiling" },
      { name: "Wall tiling", type: "wall_tiling" },
    ],
  },
  {
    code: "29",
    group: "Decoration",
    items: [
      { name: "Internal painting", type: "internal_painting" },
      { name: "External painting", type: "external_painting" },
    ],
  },
  {
    code: "33",
    group: "Drainage below ground",
    items: [
      { name: "Foul drainage runs", type: "foul_drainage" },
      { name: "Surface-water drainage", type: "surface_drainage" },
      { name: "Manholes & inspection chambers", type: "manholes" },
      { name: "Soakaway construction", type: "soakaway" },
    ],
  },
  {
    code: "34",
    group: "Site works & external",
    items: [
      { name: "Hardstanding & paving", type: "paving" },
      { name: "Kerbs & edgings", type: "kerbs_edgings" },
      { name: "Boundary walls & fencing", type: "boundary_fencing" },
      { name: "Landscaping & planting", type: "landscaping" },
    ],
  },
  {
    code: "37",
    group: "Mechanical services",
    items: [
      { name: "Cold & hot water installation", type: "water_installation" },
      { name: "Sanitaryware installation", type: "sanitaryware" },
      { name: "Heating / HVAC installation", type: "hvac_installation" },
      { name: "Mechanical first fix", type: "mechanical_first_fix" },
    ],
  },
  {
    code: "38",
    group: "Electrical services",
    items: [
      { name: "Electrical first fix", type: "electrical_first_fix" },
      { name: "Electrical second fix", type: "electrical_second_fix" },
      { name: "Distribution board & testing", type: "electrical_testing" },
      { name: "Lighting installation", type: "lighting_installation" },
    ],
  },
  {
    code: "41",
    group: "Testing, commissioning & handover",
    items: [
      { name: "Snagging & remedial works", type: "snagging" },
      { name: "Services commissioning", type: "commissioning" },
      { name: "Final clean", type: "final_clean" },
      { name: "Handover & as-built records", type: "handover" },
    ],
  },
];
