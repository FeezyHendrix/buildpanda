import type { WorkSection } from "./types";

/**
 * Road and drainage works, in the order a job is built and in the sections a
 * Nigerian or UK highway bill is written in (the Highways Agency Method of
 * Measurement series that a General Specification for Roads and Bridges
 * follows). Units are how each item is paid for: formation and surfacing by
 * area, earthworks and concrete by volume, kerbs, drains and markings by
 * length, bituminous material and reinforcement by weight, chambers, signs and
 * culvert units by number, and preliminaries as a sum.
 */
export const CIVILS_WORK_SECTIONS: WorkSection[] = [
  {
    code: "A",
    group: "Site clearance & preliminaries",
    items: [
      { name: "Site clearance & grubbing up", type: "site_clearance", unit: "m²" },
      { name: "Take up existing kerbs & paving", type: "take_up_kerbs_paving", unit: "m" },
      { name: "Break out existing carriageway", type: "break_out_carriageway", unit: "m²" },
      { name: "Demolish existing structure", type: "demolish_structure", unit: "number" },
      { name: "Site compound & mobilisation", type: "site_compound_mobilisation", unit: "sum" },
    ],
  },
  {
    code: "B",
    group: "Setting out & survey",
    items: [
      { name: "Centreline setting out", type: "centreline_setting_out", unit: "m" },
      { name: "Topographic & chainage survey", type: "topographic_survey", unit: "m" },
      { name: "Cross-section & level pegs", type: "cross_section_pegs", unit: "number" },
      { name: "As-built survey", type: "as_built_survey", unit: "m" },
    ],
  },
  {
    code: "C",
    group: "Earthworks & formation",
    items: [
      { name: "Strip topsoil", type: "strip_topsoil", unit: "m²" },
      { name: "Cut to formation", type: "cut_to_formation", unit: "m³" },
      { name: "Fill & embankment construction", type: "fill_embankment", unit: "m³" },
      { name: "Cart away to approved tip", type: "cart_away_tip", unit: "m³" },
      { name: "Excavate unsuitable material", type: "excavate_unsuitable", unit: "m³" },
      { name: "Trim & compact formation", type: "trim_compact_formation", unit: "m²" },
      { name: "Compaction & CBR testing", type: "compaction_cbr_testing", unit: "number" },
    ],
  },
  {
    code: "D",
    group: "Capping & sub-base",
    items: [
      { name: "Capping layer to formation", type: "capping_layer", unit: "m³" },
      { name: "Import laterite & spread", type: "import_laterite_spread", unit: "m³" },
      { name: "Lay & compact sub-base (crushed stone)", type: "sub_base_crushed_stone", unit: "m³" },
      { name: "Stabilised sub-base (cement / lime)", type: "stabilised_sub_base", unit: "m²" },
      { name: "Proof roll & level survey of sub-base", type: "sub_base_proof_roll", unit: "m²" },
    ],
  },
  {
    code: "E",
    group: "Base course",
    items: [
      { name: "Lay & compact crushed-stone base", type: "stone_base_course", unit: "m³" },
      { name: "Dense bitumen macadam base", type: "dbm_base", unit: "tonne" },
      { name: "Prime coat to base", type: "prime_coat", unit: "m²" },
      { name: "Base course level & regulating", type: "base_regulating", unit: "tonne" },
    ],
  },
  {
    code: "F",
    group: "Bituminous surfacing",
    items: [
      { name: "Tack coat", type: "tack_coat", unit: "m²" },
      { name: "Asphaltic concrete binder course", type: "asphalt_binder_course", unit: "tonne" },
      { name: "Asphaltic concrete wearing course", type: "asphalt_wearing_course", unit: "tonne" },
      { name: "Surface dressing / chip seal", type: "surface_dressing", unit: "m²" },
      { name: "Mill out & patch failed asphalt", type: "mill_patch_asphalt", unit: "m²" },
      { name: "Joint sealing to surfacing", type: "joint_sealing", unit: "m" },
    ],
  },
  {
    code: "G",
    group: "Kerbs, footways & drainage channels",
    items: [
      { name: "Precast concrete kerbs & backing", type: "precast_kerbs", unit: "m" },
      { name: "Channel & edging to carriageway", type: "channel_edging", unit: "m" },
      { name: "Footway construction", type: "footway_construction", unit: "m²" },
      { name: "Paved / interlocking block footway", type: "block_paved_footway", unit: "m²" },
      { name: "Lined side drain (concrete)", type: "lined_side_drain", unit: "m" },
      { name: "Earth side drain & regrading", type: "earth_side_drain", unit: "m" },
    ],
  },
  {
    code: "H",
    group: "Drainage & culverts",
    items: [
      { name: "Excavate for culvert / drain trench", type: "excavate_drain_trench", unit: "m³" },
      { name: "Blinding to culvert base", type: "culvert_blinding", unit: "m²" },
      { name: "Cast in-situ box culvert base & walls", type: "box_culvert_base_walls", unit: "m³" },
      { name: "Box culvert top slab & headwalls", type: "box_culvert_top_slab", unit: "m³" },
      { name: "Lay precast box culvert units", type: "precast_box_culvert", unit: "number" },
      { name: "Lay pipe culvert & bedding", type: "pipe_culvert", unit: "m" },
      { name: "Manholes & catchpits", type: "manholes_catchpits", unit: "number" },
      { name: "Gully & connection to drain", type: "gully_connection", unit: "number" },
      { name: "Backfill & compact around structure", type: "backfill_around_structure", unit: "m³" },
      { name: "Scour protection & stone pitching", type: "scour_protection", unit: "m²" },
    ],
  },
  {
    code: "J",
    group: "Structures & concrete works",
    items: [
      { name: "Reinforcement fixing", type: "civil_reinforcement_fixing", unit: "tonne" },
      { name: "Formwork to structure", type: "civil_formwork", unit: "m²" },
      { name: "Structural concrete pour", type: "civil_structural_concrete", unit: "m³" },
      { name: "Retaining wall construction", type: "retaining_wall", unit: "m³" },
      { name: "Bridge deck & beams", type: "bridge_deck_beams", unit: "m²" },
      { name: "Bearings, joints & parapets", type: "bearings_joints_parapets", unit: "m" },
      { name: "Piling", type: "piling", unit: "m" },
      { name: "Gabion & reno mattress works", type: "gabion_works", unit: "m³" },
    ],
  },
  {
    code: "K",
    group: "Road furniture & markings",
    items: [
      { name: "Thermoplastic road marking", type: "road_marking", unit: "m" },
      { name: "Road studs & delineators", type: "road_studs", unit: "number" },
      { name: "Traffic signs & posts", type: "traffic_signs", unit: "number" },
      { name: "Guardrail / crash barrier", type: "guardrail", unit: "m" },
      { name: "Street lighting installation", type: "street_lighting", unit: "number" },
      { name: "Chainage & boundary markers", type: "chainage_markers", unit: "number" },
    ],
  },
  {
    code: "L",
    group: "Traffic management & accommodation works",
    items: [
      { name: "Traffic management plan & approval", type: "traffic_management_plan", unit: "sum" },
      { name: "Temporary signage & cones", type: "temporary_signage", unit: "m" },
      { name: "Diversion / haul road construction", type: "diversion_road", unit: "m" },
      { name: "Flagmen & traffic control", type: "traffic_control", unit: "number" },
      { name: "Service & utility diversion", type: "utility_diversion", unit: "m" },
    ],
  },
  {
    code: "M",
    group: "Landscaping & reinstatement",
    items: [
      { name: "Topsoil & seeding to slopes", type: "topsoil_seeding", unit: "m²" },
      { name: "Tree planting & shrubs", type: "tree_planting", unit: "number" },
      { name: "Reinstate verges & accesses", type: "reinstate_verges", unit: "m²" },
      { name: "Clear site & final clean", type: "civil_final_clean", unit: "sum" },
    ],
  },
];
