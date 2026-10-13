export type SiteFeatureId = "updates" | "inspections" | "verification";
export type InspectionStatus = "pass" | "observation";

export const siteSection = {
  eyebrow: "Site Construction",
  headline: { lead: "Know what’s happening on site", accent: "currently" },
  body: "Progress reported from site becomes evidence: photographed, inspected and independently verified, so reported progress and real progress are the same number.",
  features: [
    {
      id: "updates",
      title: "Progress updates & site photos",
      description: "Daily updates from site, geotagged and time-stamped against the task they belong to.",
    },
    {
      id: "inspections",
      title: "Inspections",
      description: "Structured checklists per stage, with defects raised, assigned and closed out on the record.",
    },
    {
      id: "verification",
      title: "Independent verification",
      description: "A third-party inspector can confirm what was actually built before anyone signs off on it.",
    },
  ] satisfies ReadonlyArray<{ id: SiteFeatureId; title: string; description: string }>,
  // ILLUSTRATIVE: sample records from the design, not a real project.
  photo: {
    image: {
      src: "/site/site-image.png",
      width: 1077,
      height: 560,
      alt: "Concrete-framed tower under construction, with scaffolding and edge netting on the upper floors.",
    },
    location: "Level 04 · Grid C-F",
    meta: "14 photos · Today 08:42",
    title: "Slab pour complete (Level 4)",
    byline: "Posted by Shalom Asenuga, Site Manager",
    status: "Verified",
  },
  inspection: {
    title: "Inspection - Structural, Level 4",
    code: "INS-0421",
    items: [
      { label: "Rebar spacing & cover", status: "pass" },
      { label: "Formwork alignment", status: "pass" },
      { label: "Concrete cube samples", status: "pass" },
      { label: "Edge protection", status: "observation" },
    ] satisfies ReadonlyArray<{ label: string; status: InspectionStatus }>,
    statusLabels: { pass: "Pass", observation: "Observation" } satisfies Record<InspectionStatus, string>,
    verified: "Independently verified by Olaoluwa Glover, released to milestone",
  },
} as const;
