import { navActions } from "./nav";

export type StepId = "upload" | "analyse" | "sheet";

export const takeoff = {
  eyebrow: "Panda AI",
  headline: ["Upload a drawing", "Get a full take-off in seconds!"],
  body: "Panda AI reads your architectural drawings the way a senior estimator would, then does in seconds what normally takes days of manual measurement.",
  action: navActions.demo,
  drawing: {
    filename: "ArchitecturalPlan.pdf",
    image: {
      src: "/takeoff/plan1.png",
      width: 1120,
      height: 820,
      alt: "Architectural floor plan with rooms, dimensions and door and window tags.",
    },
    /**
     * Callouts Panda AI pins to the drawing as it finds each element.
     * `x`/`y` are the pinned point, as a percentage of the plan image.
     * `step` is the sheet step at which the callout appears (see `.sheet-track`).
     */
    callouts: [
      { id: "wall", label: "WALL·215mm", x: 25.9, y: 47.8, step: 1 },
      { id: "window", label: "WINDOW·600x600mm", x: 67.6, y: 57.6, step: 2 },
      { id: "door", label: "DOOR·900x2100mm", x: 37.1, y: 76.2, step: 2 },
    ],
  },
  // ILLUSTRATIVE: sample output from the design, not figures from a real project.
  sheet: {
    title: "Generated takeoff sheet",
    count: "214 items",
    more: "208 further items",
    rows: [
      { item: "External wall — 215mm blockwork", quantity: "1,264.40", unit: "m²", unitName: "square metres" },
      { item: "Internal partitions — metal stud", quantity: "918.20", unit: "m²", unitName: "square metres" },
      { item: "Floor slab — RC 250mm", quantity: "842.00", unit: "m²", unitName: "square metres" },
      { item: "Door openings — single leaf", quantity: "64", unit: "nr", unitName: "number" },
      { item: "Window openings — type W3", quantity: "38", unit: "nr", unitName: "number" },
      { item: "Skirting — MDF 120mm", quantity: "1,412.60", unit: "m", unitName: "metres" },
    ],
    /** Rows that scroll into view, one per step, as the drawing is read. */
    found: [
      { item: "Wall", quantity: "0.23", unit: "m", unitName: "metres" },
      { item: "Windows", quantity: "4", unit: "nr", unitName: "number" },
    ],
  },
  steps: [
    {
      id: "upload",
      title: "Upload the drawing",
      description:
        "Drop in an architectural PDF, DWG or scan. Sheets, revisions and scale are read automatically.",
    },
    {
      id: "analyse",
      title: "Panda AI analyses it",
      description:
        "Walls, slabs, openings, finishes and fittings are identified, measured and classified against your rate library.",
    },
    {
      id: "sheet",
      title: "Takeoff sheet generated",
      description:
        "A full, itemised takeoff with quantities lands in your estimate, reviewable, editable, traceable to the drawing.",
    },
  ] satisfies ReadonlyArray<{ id: StepId; title: string; description: string }>,
} as const;
