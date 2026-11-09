export type WorkspaceFeatureId =
  | "stages"
  | "team"
  | "finances"
  | "charts"
  | "approvals"
  | "tasks"
  | "lookAheads"
  | "rfis"
  | "updates";

export const workspace = {
  eyebrow: "Run the project",
  headline: { lead: "Everything the project team needs,", accent: "in one workspace" },
  body: "Programme of work, budget, tasks, documents and milestones are all views of the same project record. Change one and the rest stay honest.",
  // DRAFT descriptions (all but the last): the design repeats one placeholder
  // line in every cell. Approved to ship as drafts; replace when final copy exists.
  features: [
    {
      id: "stages",
      title: "Build Stages",
      description:
        "Break the build into stages, from substructure to finishes, and see which are done, under way or held up.",
    },
    {
      id: "team",
      title: "Team Management",
      description: "Bring everyone on the project into one place and set what each person can see, do and approve.",
    },
    {
      id: "finances",
      title: "Finances",
      description: "Track the budget, deposits, milestone releases and payments recorded against the project.",
    },
    {
      id: "charts",
      title: "Project Charts",
      description: "The programme as a chart: planned against actual, so slippage shows as soon as it starts.",
    },
    {
      id: "approvals",
      title: "Approvals",
      description:
        "Variations, payments and inspections go to the right person to sign off, with every decision on the record.",
    },
    {
      id: "tasks",
      title: "Tasks",
      description: "Give every piece of work an owner and a due date, tied to the stage it belongs to.",
    },
    {
      id: "lookAheads",
      title: "Look Aheads",
      description: "Plan the next few weeks of work, labour and deliveries so the site is never left waiting.",
    },
    {
      id: "rfis",
      title: "RFIs (Request for Information)",
      description:
        "Raise a question against a drawing, send it to the right consultant and keep the answer on the record.",
    },
    {
      id: "updates",
      title: "Progress updates & site photos",
      description: "Daily updates from site, geotagged and time-stamped against the task they belong to.",
    },
  ] satisfies ReadonlyArray<{ id: WorkspaceFeatureId; title: string; description: string }>,
} as const;
