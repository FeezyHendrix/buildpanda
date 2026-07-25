export interface BesmmSection {
  code: string;
  title: string;
  pageFrom: number;
  pageTo: number;
}

// BESMM4 tabulated work sections keyed to their corpus (PDF) page ranges, from
// a cover-to-cover read. Page ranges are used to tag each corpus chunk with the
// section it belongs to, and to scope retrieval to an element's own sections.
export const BESMM_SECTIONS: BesmmSection[] = [
  { code: "GR", title: "General Rules", pageFrom: 16, pageTo: 32 },
  { code: "1.1", title: "Preliminaries", pageFrom: 65, pageTo: 111 },
  { code: "1.2", title: "Off-Site Manufactured Materials", pageFrom: 112, pageTo: 114 },
  { code: "1.3", title: "Demolitions", pageFrom: 115, pageTo: 119 },
  { code: "1.4", title: "Alterations, Repairs and Conservation", pageFrom: 120, pageTo: 130 },
  { code: "1.5", title: "Excavating and Filling", pageFrom: 131, pageTo: 148 },
  { code: "1.7", title: "Piling", pageFrom: 149, pageTo: 153 },
  { code: "1.8", title: "Underpinning", pageFrom: 154, pageTo: 155 },
  { code: "1.9", title: "Diaphragm Walls and Embedded Retaining Walls", pageFrom: 156, pageTo: 157 },
  { code: "1.10", title: "Crib Walls, Gabion and Reinforced Earth", pageFrom: 158, pageTo: 160 },
  { code: "1.11", title: "In-situ Concrete Works", pageFrom: 161, pageTo: 173 },
  { code: "1.12", title: "Precast/Composite Concrete", pageFrom: 174, pageTo: 175 },
  { code: "1.13", title: "Precast Concrete", pageFrom: 176, pageTo: 178 },
  { code: "1.14", title: "Masonry", pageFrom: 179, pageTo: 187 },
  { code: "1.15", title: "Structural Metalwork", pageFrom: 188, pageTo: 194 },
  { code: "1.16", title: "Carpentry", pageFrom: 195, pageTo: 198 },
  { code: "1.17", title: "Sheet Roof Covering", pageFrom: 199, pageTo: 204 },
  { code: "1.18", title: "Tile and Slate Roof and Wall", pageFrom: 205, pageTo: 208 },
  { code: "1.19", title: "Waterproofing", pageFrom: 209, pageTo: 212 },
  { code: "1.20", title: "Proprietary Linings and Partitions", pageFrom: 213, pageTo: 219 },
  { code: "1.21", title: "Cladding and Covering", pageFrom: 220, pageTo: 223 },
  { code: "1.22", title: "General Joinery", pageFrom: 224, pageTo: 231 },
  { code: "1.23", title: "Windows, Screens and Lights", pageFrom: 232, pageTo: 234 },
  { code: "1.24", title: "Doors, Shutters and Hatches", pageFrom: 235, pageTo: 237 },
  { code: "1.25", title: "Stairs, Walkways and Balustrades", pageFrom: 238, pageTo: 240 },
  { code: "1.26", title: "Metal Work", pageFrom: 241, pageTo: 243 },
  { code: "1.27", title: "Glazing", pageFrom: 244, pageTo: 246 },
  { code: "1.28", title: "Floor, Wall, Ceiling and Roof Finishings", pageFrom: 247, pageTo: 259 },
  { code: "1.30", title: "Suspended Ceilings", pageFrom: 260, pageTo: 263 },
  { code: "1.31", title: "Insulation, Fire Stopping and Fire Protection", pageFrom: 264, pageTo: 265 },
  { code: "1.32", title: "Furniture, Fittings and Equipment", pageFrom: 266, pageTo: 267 },
  { code: "1.33", title: "Drainage Above Ground", pageFrom: 268, pageTo: 272 },
  { code: "1.34", title: "Drainage Below Ground", pageFrom: 273, pageTo: 281 },
  { code: "1.35", title: "Site Works", pageFrom: 282, pageTo: 290 },
  { code: "1.36", title: "Fencing", pageFrom: 291, pageTo: 293 },
  { code: "1.37", title: "Soft Landscaping", pageFrom: 294, pageTo: 298 },
  { code: "1.38", title: "Mechanical Services", pageFrom: 299, pageTo: 309 },
  { code: "1.39", title: "Electrical Services", pageFrom: 310, pageTo: 318 },
  { code: "1.40", title: "Transportation", pageFrom: 319, pageTo: 323 },
  { code: "2A", title: "Civil: General Items", pageFrom: 324, pageTo: 331 },
  { code: "2B", title: "Civil: Ground Investigation", pageFrom: 332, pageTo: 346 },
  { code: "2C", title: "Civil: Geotechnical and Specialist Processes", pageFrom: 347, pageTo: 355 },
  { code: "2D", title: "Civil: Demolition and Site Clearance", pageFrom: 356, pageTo: 358 },
  { code: "2E", title: "Civil: Earthworks", pageFrom: 359, pageTo: 373 },
  { code: "2F", title: "Civil: In-situ Concrete", pageFrom: 374, pageTo: 383 },
  { code: "2G", title: "Civil: Concrete Ancillaries", pageFrom: 384, pageTo: 394 },
  { code: "2H", title: "Civil: Precast Concrete", pageFrom: 395, pageTo: 397 },
  { code: "2J", title: "Civil: Pipework - Pipes, Fittings, Valves", pageFrom: 398, pageTo: 401 },
  { code: "2K", title: "Civil: Pipework - Fittings and Valves", pageFrom: 402, pageTo: 405 },
  { code: "2L", title: "Civil: Pipework - Manholes and Ancillaries", pageFrom: 406, pageTo: 413 },
  { code: "2M", title: "Civil: Pipework - Supports and Protection", pageFrom: 414, pageTo: 422 },
  { code: "2N", title: "Civil: Structural Metalwork", pageFrom: 423, pageTo: 426 },
  { code: "2P", title: "Civil: Miscellaneous Metalwork", pageFrom: 427, pageTo: 430 },
  { code: "2Q", title: "Civil: Timber", pageFrom: 431, pageTo: 432 },
  { code: "2R", title: "Civil: Piles", pageFrom: 433, pageTo: 440 },
  { code: "2S", title: "Civil: Piling Ancillaries", pageFrom: 441, pageTo: 448 },
  { code: "2T", title: "Civil: Roads and Pavings", pageFrom: 449, pageTo: 460 },
  { code: "2U", title: "Civil: Railway Track Construction", pageFrom: 461, pageTo: 471 },
  { code: "2V", title: "Civil: Tunnel", pageFrom: 472, pageTo: 479 },
  { code: "2W", title: "Civil: Brickwork, Blockwork and Masonry", pageFrom: 480, pageTo: 484 },
  { code: "2X", title: "Civil: Painting", pageFrom: 485, pageTo: 487 },
  { code: "2Y", title: "Civil: Waterproofing", pageFrom: 488, pageTo: 491 },
  { code: "2Z", title: "Civil: Miscellaneous Work", pageFrom: 492, pageTo: 509 },
];

const SORTED = [...BESMM_SECTIONS].sort((a, b) => a.pageFrom - b.pageFrom);

export function sectionForPage(page: number): BesmmSection {
  let match: BesmmSection | null = null;
  for (const s of SORTED) {
    if (page >= s.pageFrom && page <= s.pageTo) match = s;
  }
  if (match) return match;
  if (page < SORTED[0]!.pageFrom) return { code: "FRONT", title: "Front Matter", pageFrom: page, pageTo: page };
  return SORTED[SORTED.length - 1]!;
}
