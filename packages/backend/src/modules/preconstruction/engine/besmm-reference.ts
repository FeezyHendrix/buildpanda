// Description exemplars taken from the BESMM4 bill-preparation reference
// (FCDA Public Building Department) supplied as the house standard. Agents
// imitate this voice; they must not invent measurement rules beyond it.

export interface ElementBrief {
  key: string;
  element: string;
  guidance: string;
  exemplars: string[];
}

export const BESMM_ELEMENT_BRIEFS: ElementBrief[] = [
  {
    key: "substructure",
    element: "Substructure",
    guidance:
      "Excavation, filling, concrete, formwork and reinforcement quantities require structural drawings and sections. Without them every item here is PROVISIONAL or derived from the building footprint anchor only.",
    exemplars: [
      "Site Clearance; Clearing site vegetation and other growth and dispose off site; entire site — Sq.m",
      "Site Preparation; Remove topsoil 150mm deep — Sq.m",
      "Excavation, commencing from stripped level; Foundation excavation; Not exceeding 2m deep — Cu.m",
      "Disposal; Excavated material off site — Cu.m",
      "Filling obtained from excavated material; Final thickness of filling not exceeding 500mm deep; backfilling foundations; in layers average depth 250mm — Sq.m",
      "Weak Concrete (1:10 - graded sub base); Horizontal Work; less or equal to 300 thick; in blinding; poured on or against earth or unblinded hardcore — Cu.m",
      "Grade 25 Concrete; Horizontal Work; Over 300mm thick; In structures; Reinforced less or equal to 5% — Cu.m",
      "Plain formwork; Sides of foundations and bases; less or equal to 500mm high — Lin.m",
      "0.26mm Damp proof membrane laid with welded joints — Sq.m",
    ],
  },
  {
    key: "blockwork",
    element: "Walls",
    guidance:
      "The measured anchor wall_area_m2 is gross blockwork both storeys as measured. Associated items derive from it: rendering/plastering is applied to BOTH faces (2 x wall area) unless openings are deducted; painting follows the plastered area.",
    exemplars: [
      "Hollow sandcrete blockwall bedded and jointed in cement and sand (1:6); Walls; 225mm thick; blockwork; skin of hollow walls; laid in stretcher bond — Sq.m",
      "Cement and sand (1:4) smooth rendering; Plastering to Walls 12mm thick — Sq.m",
      "Painting to general surfaces; Over 300mm girth; external — Sq.m",
      "Painting to general surfaces; prepare and apply two coats emulsion paint; internal — Sq.m",
    ],
  },
  {
    key: "openings",
    element: "Windows and doors",
    guidance:
      "Door and window counts per type are measured anchors (door_TYPE, window_TYPE). Frames, ironmongery, glazing and painting derive one-for-one from those counts. Leaf sizes are NOT measured — keep sizes out of descriptions or mark the item provisional.",
    exemplars: [
      "Flush doors; internal quality; complete with frame — Nr",
      "Ironmongery; supply and fix mortice lock complete with handles — Nr",
      "Aluminium windows; complete with frame and fittings; as window schedule — Nr",
      "Burglar proofing with approved steel members to window openings — Sq.m",
      "Surface Treatment; painting; On site; One primer and two finishing coats to door leaf and frame — Nr",
    ],
  },
  {
    key: "finishes",
    element: "Finishes",
    guidance:
      "floor_area_m2 is the measured room-flood anchor and is usually PARTIAL coverage. Screeds, floor finishes, skirtings and ceiling finishes derive from it; state clearly that coverage follows the measured rooms only.",
    exemplars: [
      "Cement and Sand (1:6) screeded beds; Screeds, beds and toppings, 40mm thick in one coat — Sq.m",
      "Plastering to Walls 12mm thick; Less or equal to 600mm wide — Sq.m",
      "Painting to general surfaces; Over 300mm girth — Sq.m",
    ],
  },
  {
    key: "roof",
    element: "Roof",
    guidance:
      "Roof structure and coverings cannot be measured from floor plans. Every item is PROVISIONAL until roof plans/sections are provided.",
    exemplars: [
      "Allow for the Fabrication and Erection of Structural steel roof members — Sum",
      "0.70mm longspan Aluminium roofing sheets; Pitch 15 degrees — Sq.m",
      "Eaves Angle; 150 girth — Lin.m",
    ],
  },
  {
    key: "services",
    element: "Services",
    guidance:
      "Electrical, mechanical and plumbing installations require MEP drawings. Emit PROVISIONAL sums only; never derive service quantities from architectural anchors.",
    exemplars: [
      "Allow a provisional sum for electrical installations complete — Sum",
      "Allow a provisional sum for plumbing and sanitary installations complete — Sum",
      "Allow a provisional sum for mechanical ventilation and air conditioning — Sum",
    ],
  },
];
