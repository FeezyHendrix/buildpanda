/**
 * Static project templates for fast residential project setup.
 * Each template lists ordered stages with typical relative durations (weeks)
 * and a few starter tasks per stage. Durations are relative — projects carry
 * no start date at creation, so stages get "Weeks X – Y" range labels and
 * null start/end dates for the PM to firm up on the schedule page.
 */

export const PROJECT_TEMPLATES = [
  {
    id: "residential-new-build",
    name: "New build home",
    description:
      "Ground-up residential build: survey and permits through structure, finishes and handover.",
    stages: [
      {
        name: "Site Survey & Soil Testing",
        durationWeeks: 2,
        tasks: ["Commission topographic survey", "Book geotechnical soil investigation"],
      },
      {
        name: "Permitting & Approvals",
        durationWeeks: 6,
        tasks: ["Submit building permit application", "Confirm utility connection approvals"],
      },
      {
        name: "Foundation & Substructure",
        durationWeeks: 8,
        tasks: ["Set out and excavate foundations", "Arrange foundation inspection before pour"],
      },
      {
        name: "Superstructure & Roofing",
        durationWeeks: 12,
        tasks: ["Order structural steel and blockwork", "Schedule roof covering installation"],
      },
      {
        name: "MEP First Fix",
        durationWeeks: 6,
        tasks: ["Coordinate electrical and plumbing rough-in", "Book first-fix inspection"],
      },
      {
        name: "Finishes & Second Fix",
        durationWeeks: 8,
        tasks: ["Confirm client finishes selections", "Sequence tiling, joinery and painting"],
      },
      {
        name: "External Works & Handover",
        durationWeeks: 4,
        tasks: ["Complete driveway and landscaping", "Run snagging list and handover pack"],
      },
    ],
  },
  {
    id: "residential-renovation",
    name: "Renovation",
    description:
      "Whole-home renovation: strip-out, structural and services updates, then full refit.",
    stages: [
      {
        name: "Existing Condition Survey",
        durationWeeks: 2,
        tasks: ["Record existing condition with photos", "Check for asbestos and hazards"],
      },
      {
        name: "Scope Confirmation & Approvals",
        durationWeeks: 2,
        tasks: ["Freeze renovation scope with client", "Confirm permits for structural changes"],
      },
      {
        name: "Demolition & Strip-out",
        durationWeeks: 2,
        tasks: ["Isolate services before strip-out", "Arrange skip and waste disposal"],
      },
      {
        name: "Structural & Services Adjustments",
        durationWeeks: 6,
        tasks: ["Install new structural openings", "Re-route plumbing and electrics"],
      },
      {
        name: "Interior Build-out",
        durationWeeks: 8,
        tasks: ["Board and plaster new layouts", "Fit kitchen and bathroom carcasses"],
      },
      {
        name: "Finishes & Handover",
        durationWeeks: 4,
        tasks: ["Complete decoration and flooring", "Snag, clean and hand over"],
      },
    ],
  },
  {
    id: "residential-extension",
    name: "Extension",
    description:
      "Single or double-storey extension: groundworks, shell, tie-in to the existing house and finishes.",
    stages: [
      {
        name: "Design & Approvals",
        durationWeeks: 4,
        tasks: ["Finalise extension drawings", "Obtain planning and building approvals"],
      },
      {
        name: "Groundworks & Foundations",
        durationWeeks: 3,
        tasks: ["Locate and protect existing drains", "Pour and inspect foundations"],
      },
      {
        name: "Shell Construction",
        durationWeeks: 6,
        tasks: ["Build walls to wallplate", "Install roof structure and covering"],
      },
      {
        name: "Tie-in & Weatherproofing",
        durationWeeks: 2,
        tasks: ["Break through to existing house", "Seal and flash all junctions"],
      },
      {
        name: "Fit-out & Finishes",
        durationWeeks: 6,
        tasks: ["First and second fix services", "Plaster, decorate and floor"],
      },
      {
        name: "Snagging & Handover",
        durationWeeks: 1,
        tasks: ["Complete snagging list", "Issue completion certificates"],
      },
    ],
  },
  {
    id: "residential-fit-out",
    name: "Interior fit-out",
    description:
      "Interior-only fit-out of an existing shell: partitions, services, joinery and finishes.",
    stages: [
      {
        name: "Survey & Setting Out",
        durationWeeks: 1,
        tasks: ["Verify shell dimensions on site", "Mark partition and services layouts"],
      },
      {
        name: "Partitions & First Fix",
        durationWeeks: 3,
        tasks: ["Erect partitions and ceilings", "Run electrical and plumbing first fix"],
      },
      {
        name: "Joinery & Second Fix",
        durationWeeks: 4,
        tasks: ["Install doors and built-in joinery", "Fit sanitaryware and light fittings"],
      },
      {
        name: "Finishes",
        durationWeeks: 3,
        tasks: ["Decorate walls and ceilings", "Lay floor finishes"],
      },
      {
        name: "Commissioning & Handover",
        durationWeeks: 1,
        tasks: ["Test and commission services", "Snag and hand over"],
      },
    ],
  },
] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATES)[number]["id"];
export const PROJECT_TEMPLATE_IDS = PROJECT_TEMPLATES.map((t) => t.id) as ProjectTemplateId[];

export interface ProjectTemplateStage {
  name: string;
  durationWeeks: number;
  tasks: readonly string[];
}

export interface ProjectTemplate {
  id: ProjectTemplateId;
  name: string;
  description: string;
  stages: readonly ProjectTemplateStage[];
}

export function findTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

/** "Weeks 1 – 2" range labels from cumulative relative durations. */
export function stageDateRanges(stages: readonly ProjectTemplateStage[]): string[] {
  const labels: string[] = [];
  let week = 1;
  for (const stage of stages) {
    const end = week + stage.durationWeeks - 1;
    labels.push(end === week ? `Week ${week}` : `Weeks ${week} – ${end}`);
    week = end + 1;
  }
  return labels;
}

export interface ProjectTemplateSummary {
  id: ProjectTemplateId;
  name: string;
  description: string;
  stageCount: number;
  taskCount: number;
  totalWeeks: number;
  stages: Array<{ name: string; durationWeeks: number; dateRange: string }>;
}

export function toTemplateSummary(template: ProjectTemplate): ProjectTemplateSummary {
  const ranges = stageDateRanges(template.stages);
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    stageCount: template.stages.length,
    taskCount: template.stages.reduce((sum, s) => sum + s.tasks.length, 0),
    totalWeeks: template.stages.reduce((sum, s) => sum + s.durationWeeks, 0),
    stages: template.stages.map((s, idx) => ({
      name: s.name,
      durationWeeks: s.durationWeeks,
      dateRange: ranges[idx]!,
    })),
  };
}
