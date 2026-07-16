// Billing method distilled from the BESMM4 bill-preparation reference
// (Ogunkanmi, FCDA Public Building Department) — the house standard. This is
// a TEMPLATE of how a QS structures each element, not a list of one-liners:
//   - a numbered work section (e.g. "1.11: INSITU CONCRETE WORKS")
//   - an unnumbered MATERIAL PREAMBLE carrying the full specification
//   - group headings ("Door Sets", "Formwork - Plain formwork")
//   - short items carrying only particulars; consecutive similar items say
//     "Ditto"; finishes split into width bands (<=600mm = m, >600mm = m2);
//   - every element closes "CARRIED TO SUMMARY".

import type { StructureClass } from "../types.ts";

export interface ElementBrief {
  key: string;
  element: string;
  guidance: string;
  template: string;
  sectionCodes?: string[];
  retrievalQuery?: string;
  classes?: StructureClass[];
}

// Standard element order in the bill (measured + agent elements both map here).
export const BESMM_ELEMENT_ORDER = [
  "Preliminaries",
  "Substructure",
  "Frame",
  "Upper floors",
  "Staircases",
  "Roof",
  "Internal and external walls",
  "Windows",
  "Doors",
  "Wall finishings",
  "Floor finishings",
  "Ceiling finishings",
  "Mechanical services",
  "Electrical services",
  "External works",
] as const;

export const BESMM_ELEMENT_BRIEFS: ElementBrief[] = [
  {
    key: "substructure",
    element: "Substructure",
    guidance:
      "Infer the strip-foundation substructure from wall_centreline_m and floor coverage the way a QS would, stating every assumed dimension. The FULL family is expected: excavating and filling (site clearance, topsoil, foundation excavation, disposal, backfilling, hardcore, DPM), concrete (trench mass concrete, blinding, oversite), formwork (sides of foundations), reinforcement in TONNES by bar diameter (assume and state a kg/m3 rate over the concrete volume formula, /1000 for tonnes), foundation blockwork with DPC, and rendering to substructure walls. CONSISTENCY RULE: the whole family shares ONE set of assumed trench dimensions — state them once and reuse the same width/depth in every formula; concrete volume can never exceed excavation volume; blinding is the thin layer (assumed 50mm), never the same volume as trench concrete.",
    template: `1.5: EXCAVATING AND FILLING
  (items) Site Clearance; Clearing site vegetation and other growth and dispose off site; entire site -- m2
          Site Preparation; Remove topsoil 150mm deep -- m2
          Excavation, commencing from stripped level; Foundation excavation; Not exceeding 2m deep -- m3
          Disposal; Excavated material off site -- m3
  (group) Filling obtained from excavated material
  (items) Final thickness of filling not exceeding 500mm deep; backfilling foundations; in layers average depth 250mm -- m2
  (preamble) Granite or other equal and approved Hardcore football size
  (items) Imported Filling; Beds 50mm - 500mm deep 300mm thick; Level, to falls and cross falls -- m3
  (preamble) Approved quality 1mm thick damp proof membrane
  (items) Damp Proof Membrane; Over 500mm wide, 1mm thick; Horizontal -- m2
1.11: INSITU CONCRETE WORKS
  (preamble) Grade 30 Concrete
  (items) Mass Concrete; 225mm thick; In trench filling; Poured on or against earth or unblinded hardcore -- m3
  (preamble) Weak Concrete (1:10 - graded sub base)
  (items) Horizontal Work; less or equal to 300 thick; in blinding; poured on or against earth or unblinded hardcore -- m3
  (group) Formwork - Plain formwork
  (items) Sides of foundations and bases; less or equal to 500mm high -- m
  (group) Reinforcement
  (items) High yield steel bars; 16mm diameter; Bent -- tonnes
          Ditto; 12mm diameter -- tonnes
          10mm diameter; Links -- tonnes
          Mesh; 4.52kg/sq.m Ref. A152 minimum laps 150mm -- m2
1.14: MASONRY
  (preamble) Hollow sandcrete blockwall bedded and jointed in cement and sand (1:6)
  (items) Walls; 225mm thick; blockwork; skin of hollow walls; laid in stretcher bond -- m2
          Damp Proof Course less or equal 300mm wide; Horizontal -- m
1.28: FLOOR WALL CEILING AND ROOF FINISHINGS
  (preamble) Cement and sand (1:4) smooth rendering
  (items) Plastering to Walls 12mm thick; over 600mm wide; externally to substructure -- m2`,
  },
  {
    key: "walls",
    element: "Internal and external walls",
    guidance:
      "The measured bill already carries the blockwork itself — DO NOT re-bill wall supply. Add only associated superstructure wall work: lintels over openings (concrete + formwork + reinforcement over door_total + window_total with stated assumed lintel section), and DPC. Rendering/painting belong to Wall finishings, not here.",
    template: `1.11: INSITU CONCRETE WORKS
  (preamble) Grade 25 Concrete in Superstructures; Plain In Situ Concrete Reinforced
  (items) Horizontal work; Less or equal to 300mm thick; In structures; in lintels; Reinforced less or equal to 5% -- m3
  (group) Formwork - Plain formwork
  (items) Sides and soffit of isolated beams; Regular rectangular shape -- m2
  (group) Reinforcement
  (items) High yield steel bars; 12mm diameter; Straight and Bent -- tonnes`,
  },
  {
    key: "windows",
    element: "Windows",
    guidance:
      "Window supply per type (window_W*) is ALREADY BILLED by the measured rows — emit NOTHING under 1.23. Your only output is associated metalwork: burglar proofing one-for-one against each type count. Sizes are unknown — 'size as window schedule', never invent dimensions.",
    template: `1.26: METAL WORK
  (preamble) Burglar Bars comprising 50 X 25 X 2mm thick surround; 25 X 25 X 2mm thick vertical bars at 150mm intervals welded to surround bar including drilling holes and fixing to concrete or blockwork complete with painting in red oxide and finishing in gloss paint
  (group) Composite Items
  (items) To window opening; size as window schedule; type W4 -- nr
          Ditto; type W6 -- nr`,
  },
  {
    key: "doors",
    element: "Doors",
    guidance:
      "Door counts per type (door_D*) are measured and already billed as door sets — DO NOT re-bill supply. Add associated work one-for-one against type counts: ironmongery per leaf and painting/decoration per leaf and frame. Sizes are unknown — 'to fit opening size as door schedule'.",
    template: `1.24: DOORS
  (preamble) 44mm thick polished seasoned solid core flush doors lipped on all edges with hardwood and faced on both sides with quality plywood complete with door lining architraves and all necessary ironmongery
  (group) Ironmongery
  (items) Supply and fix mortice lock complete with pair of handles; per leaf -- nr
          Supply and fix 100mm brass butt hinges; 1.5 pairs per leaf -- nr
1.29: DECORATIONS
  (preamble) Berger gloss or other equal and approved paint; one primer and two finishing coats
  (items) Surface Treatment; painting; On site; door leaf and frame both sides -- nr`,
  },
  {
    key: "wall-finishings",
    element: "Wall finishings",
    guidance:
      "Rendering and decoration to superstructure walls derive from wall_area_m2 (both faces = 2 x wall_area_m2). Bill the BESMM way: plaster over 600mm wide in m2 internal and external separately (state the assumed internal/external split), then painting following the plastered areas, internal and external separately.",
    template: `1.28: FLOOR WALL CEILING AND ROOF FINISHINGS
  (preamble) Cement and sand (1:4) smooth rendering
  (items) Plastering to Walls 12mm thick; over 600mm wide; internally -- m2
          Ditto; externally -- m2
1.29: DECORATIONS
  (preamble) Dulux or other equal and approved latex paint one coat; cement floated wall sandpapered smooth and one coat of primer on floated wall
  (items) Painting to general surfaces; Over 300mm girth; internal -- m2
          Ditto; external -- m2`,
  },
  {
    key: "floor-finishings",
    element: "Floor finishings",
    guidance:
      "floor_area_m2 is measured room coverage (often PARTIAL — say so). Screed already appears in the measured bill; add the finish family: floor tiles over 600mm wide in m2, skirtings in m along the wall line (derive from wall_centreline_m or floor perimeter with stated assumption).",
    template: `1.28: FLOOR WALL CEILING AND ROOF FINISHINGS
  (preamble) 600 X 600 X 15mm thick Vitrified Tile
  (items) Finish to floors, Vitrified Tiles 50mm thick overall thickness; Over 600mm wide -- m2
          Skirtings, net height 100mm; Blockwall background -- m`,
  },
  {
    key: "ceiling-finishings",
    element: "Ceiling finishings",
    guidance:
      "Ceiling area approximates floor coverage. Derive plasterboard/acoustic ceiling and its painting from floor_area_m2 with the coverage caveat stated.",
    template: `1.28: FLOOR WALL CEILING AND ROOF FINISHINGS
  (preamble) 600 X 600 X 20mm thick acoustic mineral fibre suspended ceiling in aluminium grid bearer
  (items) Finishing to ceiling, acoustic ceiling tiles 20mm thick; over 600mm wide -- m2
1.29: DECORATIONS
  (preamble) Dulux or other equal and approved latex paint; one coat primer
  (items) Painting to general surfaces; Over 300mm girth; internal -- m2`,
  },
  {
    key: "roof",
    element: "Roof",
    guidance:
      "No roof plan exists. If measured floor coverage is clearly partial, keep coverings provisional and say why. Where the plan area anchor is credible, infer like a QS with stated pitch factor: carcassing timbers as a family (rafters, wall plates, purlins in m derived from plan area with stated spacing assumptions), coverings in m2, boundary work (eaves, ridges) in m.",
    template: `1.16: CARPENTRY
  (preamble) Hardwood pressure impregnated with approved preservatives
  (group) Primary or Structural timbers
  (items) 50 X 150mm; Rafters and associated timbers -- m
          100 X 150mm; Wall Plates -- m
          50 X 75mm; Purlins -- m
1.17: SHEET ROOF COVERING
  (preamble) 0.7 gauge oven baked corrugated coloured Longspan Aluminium roofing sheet on Zed Purlins
  (items) Covering over 500mm wide; Sloping; assumed 15 degree pitch -- m2
  (group) Boundary work
  (items) 200mm girth; Eaves; Horizontal -- m
          350mm girth; Ridges; Horizontal -- m`,
  },
  {
    key: "mechanical",
    element: "Mechanical services",
    guidance:
      "No MEP drawings. Structure the element the BESMM way (Rainwater Disposal, Cold Water Supply, Waste Disposal / sanitary fittings as named systems) but every item is PROVISIONAL — named provisional items per system beat one lump sum; quantities stay unclaimed.",
    template: `1.38: MECHANICAL SERVICES
  (preamble) Mutunci or other equal and approved uPVC pipe
  (items) Rainwater Disposal System; pipework, fittings and ancillaries complete -- sum (provisional)
  (preamble) Rifeng or other equal and approved multi layer pipe
  (items) Cold and hot water supply systems; pipework, fittings and valves complete -- sum (provisional)
  (preamble) Twyford or other equal and approved sanitary fittings
  (items) Waste disposal system and sanitary fittings complete; WCs, wash hand basins, showers and accessories -- sum (provisional)`,
  },
  {
    key: "electrical",
    element: "Electrical services",
    guidance:
      "No electrical drawings. Named provisional items per system; no quantities.",
    template: `1.39: ELECTRICAL SERVICES
  (items) Lighting and power installations complete -- sum (provisional)
          Distribution boards and sub-mains -- sum (provisional)
          Earthing and lightning protection -- sum (provisional)`,
  },
  {
    key: "preliminaries",
    element: "Preliminaries",
    guidance:
      "BESMM4 Section 1 (Preliminaries). No drawing basis for pricing — structure the named preliminaries the BESMM way (employer's requirements, contractor's general cost items: site management, accommodation, services, insurances, temporary works) but every item is PROVISIONAL as a sum; quantities stay unclaimed.",
    template: `1.1: PRELIMINARIES
  (items) Employer's requirements; site records, defects liability -- sum (provisional)
          Contractor's general cost items; management and staff, site accommodation, temporary services, safety and welfare -- sum (provisional)
          Insurances and bonds -- sum (provisional)`,
  },
  {
    key: "frame",
    element: "Frame",
    guidance:
      "BESMM4 Section 11 (Insitu Concrete) / 15 (Structural Metalwork). A reinforced-concrete frame (columns and beams) inferred from the floor and wall anchors the QS way, stating every assumed member size and rebar rate — columns per storey, beams over wall centreline. Where no structural drawing supports a member, keep it PROVISIONAL. Reinforcement in tonnes from an assumed and stated kg/m3.",
    template: `1.11: FRAME — INSITU CONCRETE
  (preamble) Grade 25 reinforced concrete in superstructure frame
  (items) Vertical work; columns; assumed 225 x 225mm -- m3
  (group) Formwork - Plain formwork
  (items) Sides of columns and beams; regular shape -- m2
  (group) Reinforcement
  (items) High yield steel bars; assumed rate over concrete volume -- tonnes`,
  },
  {
    key: "upperFloors",
    element: "Upper floors",
    guidance:
      "BESMM4 Section 11 (Insitu Concrete). Suspended upper-floor slabs inferred from floor area anchors for multi-storey buildings, stating assumed slab thickness. If the drawing set is single-storey or storey count is unknown, keep PROVISIONAL — do not invent floors.",
    template: `1.11: UPPER FLOORS — SUSPENDED SLAB
  (preamble) Grade 25 reinforced concrete in suspended slabs
  (items) Horizontal work; slabs; assumed 150mm thick -- m3
  (group) Formwork
  (items) Soffits of slabs; horizontal -- m2
  (group) Reinforcement
  (items) High yield steel bars; assumed rate -- tonnes`,
  },
  {
    key: "staircases",
    element: "Staircases",
    guidance:
      "BESMM4 Section 11 (Insitu Concrete, staircases). A concrete staircase inferred only when a stair symbol/label is present in the drawing context; state assumed flight/going/riser dimensions. Absent evidence of a stair, keep the whole element PROVISIONAL.",
    template: `1.11: STAIRCASES — INSITU CONCRETE
  (preamble) Grade 25 reinforced concrete in staircases
  (items) Sloping work; staircase flights and landings; assumed dimensions -- m3
  (group) Formwork
  (items) Soffits and risers of staircase; sloping -- m2`,
  },
  {
    key: "externalWorks",
    element: "External works",
    guidance:
      "BESMM4 (drainage, roads/paving, external services, boundary walls, landscaping). No site-layout drawing basis — structure named external-works systems but keep every item PROVISIONAL as a sum; quantities stay unclaimed until a site/external layout is available.",
    template: `1.40: EXTERNAL WORKS
  (items) Site drainage; manholes, pipework and connections -- sum (provisional)
          Roads, paving and hardstandings -- sum (provisional)
          External services and boundary walls -- sum (provisional)
          Landscaping and site finishes -- sum (provisional)`,
  },
  {
    key: "piling",
    element: "Piling",
    classes: ["building", "bridge", "infrastructure"],
    guidance:
      "Only bill piling when a pile schedule / pile layout is present or a piled foundation is stated. Piles are ENUMERATED (nr) with size stated, plus bored/driven length in m. Pile reinforcement is in TONNES from the schedule; cutting off pile tops is deemed to include integrating reinforcement into the cap (BESMM C18). If no pile schedule exists, keep pile numbers and lengths PROVISIONAL — never invent pile counts or depths.",
    template: `1.7: PILING
  (preamble) Reinforced concrete bored piles; grade as specification; formed under bentonite or as method statement
  (items) Bored piles; 600mm diameter; number stated -- nr
          Bored piles; 600mm diameter; concrete in piles -- m
          Cutting off tops of piles; 600mm diameter -- nr
  (group) Reinforcement to piles
  (items) High yield steel bars; as pile schedule -- tonnes`,
  },
  {
    key: "pileCaps",
    element: "Pile caps and ground beams",
    classes: ["building", "bridge", "infrastructure"],
    guidance:
      "Bill only with a piled/RC substructure. Pile caps and ground beams are in-situ concrete (m3, reinforced) + formwork (m2) + reinforcement (tonnes). State assumed cap dimensions where a schedule is absent, and keep reinforcement provisional unless a bar bending schedule is present.",
    template: `1.11: INSITU CONCRETE WORKS
  (preamble) Grade 30 reinforced concrete in pile caps and ground beams
  (items) Horizontal work; over 300mm thick; in pile caps; reinforced over 5% -- m3
  (group) Formwork - Plain formwork
  (items) Sides of foundations; over 1.00m high -- m2
  (group) Reinforcement
  (items) High yield steel bars; as bar bending schedule -- tonnes`,
  },
  {
    key: "pavement",
    element: "Pavement (roads, runways, aprons)",
    classes: ["road", "airport", "infrastructure"],
    guidance:
      "For roads, runways, taxiways and aprons. Each pavement COURSE is measured in m2 by material type and DEPTH BAND (BESMM 2T: 100-150, 150-200, 200-250, 250-300, over 300mm). Sub-base, base and surfacing are separate courses. Steel fabric to concrete pavement is m2 by nominal-mass band. State assumed course depths where the pavement design is not dimensioned, and keep depths provisional if unknown.",
    template: `2T: ROADS AND PAVINGS
  (preamble) Flexible / rigid pavement construction to pavement design
  (group) Sub-base
  (items) Unbound sub-base; depth 150-200mm -- m2
  (group) Base course
  (items) Bituminous bound base; depth 100-150mm -- m2
  (group) Surface course
  (items) Asphalt concrete surface course; depth not exceeding 100mm -- m2`,
  },
  {
    key: "kerbsAndDrainage",
    element: "Kerbs, channels and road drainage",
    classes: ["road", "airport", "infrastructure"],
    guidance:
      "Kerbs, channels and edgings are measured in metres (2T), stating cross-section. Road/pavement joints in metres. Gullies and manholes enumerated. Keep provisional where the layout is not dimensioned.",
    template: `2T: ROADS AND PAVINGS
  (items) Precast concrete kerbs; 125 x 255mm; on concrete bed and backing -- m
          Channels; precast concrete -- m
          Expansion joints in pavement -- m
  (items) Road gullies; complete with connection -- nr`,
  },
  {
    key: "deck",
    element: "Bridge deck and superstructure",
    classes: ["bridge"],
    guidance:
      "Bridge deck, piers, abutments and parapets. Deck and piers are in-situ concrete (m3, reinforced) + formwork (m2, incl soffit propping height bands) + reinforcement (tonnes). Prestressing / post-tensioning is measured separately (number of tendons, method stated). Bearings and expansion joints enumerated. All quantities depend on the GA + reinforcement schedule; keep provisional where a schedule is absent — never fabricate deck rebar tonnage.",
    template: `2F: INSITU CONCRETE
  (preamble) Grade 40 reinforced concrete in bridge deck, piers and abutments
  (items) Concrete in deck slab -- m3
          Concrete in piers and abutments -- m3
2G: CONCRETE ANCILLARIES
  (group) Formwork
  (items) Formwork to soffit of deck; propping over 3m -- m2
  (group) Reinforcement
  (items) High yield steel bars; as bar bending schedule -- tonnes
  (group) Prestressing
  (items) Post-tensioned tendons; method as specification -- nr`,
  },
  {
    key: "earthworks",
    element: "Earthworks (civil)",
    classes: ["road", "bridge", "airport", "infrastructure"],
    guidance:
      "Civil earthworks (BESMM 2E): excavation by material and depth stage (m3), disposal (m3), filling and compaction (m3), and preparation of surfaces. For roads this is the formation/cut-fill; for bridges the foundation excavation. State assumed depths where the sections are not dimensioned.",
    template: `2E: EARTHWORKS
  (items) General excavation; to reduce levels; not exceeding 2m deep -- m3
          Disposal of excavated material off site -- m3
          Filling and compaction; imported granular fill -- m3
          Preparation of formation surface -- m2`,
  },
];

// Maps each element to the BESMM sections whose rules govern it, so RAG
// retrieval is scoped to the right sections instead of nearest-text overall.
const ELEMENT_RETRIEVAL: Record<string, { sectionCodes: string[]; retrievalQuery: string }> = {
  substructure: { sectionCodes: ["1.5", "1.7", "1.11"], retrievalQuery: "excavation filling foundation concrete blinding reinforcement in tonnes strip foundation" },
  walls: { sectionCodes: ["1.14"], retrievalQuery: "masonry brick block walling measured on centre line thickness void deduction 0.50m2" },
  windows: { sectionCodes: ["1.23", "1.27"], retrievalQuery: "windows screens lights measured enumerated glazing" },
  doors: { sectionCodes: ["1.24"], retrievalQuery: "doors shutters hatches door sets enumerated frames" },
  "wall-finishings": { sectionCodes: ["1.28"], retrievalQuery: "wall finishes plaster render m2 width bands over 600mm void deduction 1.00m2" },
  "floor-finishings": { sectionCodes: ["1.28"], retrievalQuery: "floor finishes screed tiling m2 width bands void deduction" },
  "ceiling-finishings": { sectionCodes: ["1.28", "1.30"], retrievalQuery: "ceiling finishes suspended ceilings m2" },
  roof: { sectionCodes: ["1.16", "1.17", "1.18", "1.19"], retrievalQuery: "roof coverings sheet tile slate carpentry waterproofing" },
  frame: { sectionCodes: ["1.11", "1.15"], retrievalQuery: "reinforced concrete columns beams frame reinforcement tonnes structural metalwork" },
  upperFloors: { sectionCodes: ["1.11"], retrievalQuery: "suspended concrete slab upper floors horizontal work thickness reinforced formwork soffit" },
  staircases: { sectionCodes: ["1.11", "1.25"], retrievalQuery: "staircases concrete stairs sloping work formwork" },
  mechanical: { sectionCodes: ["1.38"], retrievalQuery: "mechanical services installations item enumerated" },
  electrical: { sectionCodes: ["1.39"], retrievalQuery: "electrical services installations item enumerated points" },
  preliminaries: { sectionCodes: ["1.1"], retrievalQuery: "preliminaries employer requirements site establishment" },
  externalWorks: { sectionCodes: ["1.34", "1.35", "2T"], retrievalQuery: "drainage below ground roads pavings site works external" },
  piling: { sectionCodes: ["1.7", "2R", "2S"], retrievalQuery: "piles enumerated size stated bored driven concrete in piles cutting off tops reinforcement to piles tonnes" },
  pileCaps: { sectionCodes: ["1.11", "2F", "2G"], retrievalQuery: "pile caps ground beams reinforced concrete horizontal work formwork reinforcement tonnes" },
  pavement: { sectionCodes: ["2T"], retrievalQuery: "road pavement sub-base base surfacing course depth bands m2 unbound bituminous concrete slab" },
  kerbsAndDrainage: { sectionCodes: ["2T", "1.34"], retrievalQuery: "kerbs channels edgings metres precast concrete pavement joints gullies manholes" },
  deck: { sectionCodes: ["2F", "2G"], retrievalQuery: "bridge deck piers abutments concrete formwork soffit propping reinforcement tonnes prestressing tendons post-tension" },
  earthworks: { sectionCodes: ["2E"], retrievalQuery: "earthworks excavation depth stages disposal filling compaction formation m3" },
};

// Selects the element briefs that apply to a structure class. Briefs with no
// classes tag are building-oriented (the historical default). The item set is
// therefore the elements relevant to what the plan IS, not a fixed list.
export function briefsFor(structureClass: StructureClass): ElementBrief[] {
  if (structureClass === "unknown") return BESMM_ELEMENT_BRIEFS;
  return BESMM_ELEMENT_BRIEFS.filter((brief) => {
    const classes = brief.classes ?? ["building"];
    return classes.includes(structureClass);
  });
}

for (const brief of BESMM_ELEMENT_BRIEFS) {
  const meta = ELEMENT_RETRIEVAL[brief.key];
  if (meta) {
    brief.sectionCodes = meta.sectionCodes;
    brief.retrievalQuery = meta.retrievalQuery;
  }
}
