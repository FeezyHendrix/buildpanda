import {
  SCENE_DURATIONS,
  TITLE_DURATION,
  OUTRO_DURATION,
  TRANSITION_DURATION,
} from "./timing.generated";

export interface Point {
  x: number;
  y: number;
}

export interface Scene {
  id: string;
  src: string;
  url: string;
  title: string;
  subtitle: string;
  durationInFrames: number;
  from?: Point;
  click?: Point;
}

type SceneDef = Omit<Scene, "durationInFrames">;

const DEFS: SceneDef[] = [
  {
    id: "signup",
    src: "shots/02-signup.png",
    url: "app.buildpanda.io/auth",
    title: "Create your account",
    subtitle: "Sign up in seconds and you're ready to set up your first build.",
    from: { x: 0.5, y: 0.6 },
    click: { x: 0.5, y: 0.62 },
  },
  {
    id: "dashboard",
    src: "shots/new-01-dashboard.png",
    url: "app.buildpanda.io/dashboard",
    title: "Your projects, at a glance",
    subtitle: "Every active build, its progress and what needs you, in one view.",
    from: { x: 0.5, y: 0.5 },
    click: { x: 0.3, y: 0.4 },
  },
  {
    id: "overview",
    src: "shots/12-project-overview.png",
    url: "app.buildpanda.io/project/overview",
    title: "A project ready from day one",
    subtitle: "Budget, phases and milestones, set up for you from your documents.",
    from: { x: 0.3, y: 0.4 },
    click: { x: 0.1, y: 0.2 },
  },
  {
    id: "next",
    src: "shots/new-02-overview.png",
    url: "app.buildpanda.io/project/overview",
    title: "Always know what's next",
    subtitle: "The work that needs you today, surfaced before it slips.",
    from: { x: 0.1, y: 0.2 },
    click: { x: 0.12, y: 0.34 },
  },
  {
    id: "kanban",
    src: "shots/new-04-kanban.png",
    url: "app.buildpanda.io/project/tasks",
    title: "Plan the work on a board",
    subtitle: "Organise tasks and subtasks, and move them as the build progresses.",
    from: { x: 0.12, y: 0.34 },
    click: { x: 0.14, y: 0.42 },
  },
  {
    id: "gantt",
    src: "shots/new-05-gantt.png",
    url: "app.buildpanda.io/project/schedule",
    title: "See the whole programme",
    subtitle: "Your schedule as a Gantt chart, with dependencies and critical path.",
    from: { x: 0.14, y: 0.42 },
    click: { x: 0.16, y: 0.5 },
  },
  {
    id: "boq",
    src: "shots/08-boq.png",
    url: "app.buildpanda.io/project/materials",
    title: "Your bill of quantities, priced",
    subtitle: "Track materials against the BoQ as they're ordered and used.",
    from: { x: 0.16, y: 0.5 },
    click: { x: 0.5, y: 0.4 },
  },
  {
    id: "rfis",
    src: "shots/new-06-rfis.png",
    url: "app.buildpanda.io/project/rfis",
    title: "Raise and track RFIs",
    subtitle: "Log questions, route them, and keep every answer on the record.",
    from: { x: 0.5, y: 0.4 },
    click: { x: 0.18, y: 0.46 },
  },
  {
    id: "bim",
    src: "shots/new-07-bim.png",
    url: "app.buildpanda.io/project/bim",
    title: "Open the BIM model",
    subtitle: "View the federated model, select any element and assign it to a person.",
    from: { x: 0.18, y: 0.46 },
    click: { x: 0.5, y: 0.5 },
  },
  {
    id: "client",
    src: "shots/new-03-messages.png",
    url: "app.buildpanda.io/project/chat",
    title: "Keep the client in the loop",
    subtitle: "They see real progress and where the budget goes, so the questions stop.",
    from: { x: 0.5, y: 0.5 },
    click: { x: 0.5, y: 0.85 },
  },
];

export const SCENES: Scene[] = DEFS.map((d, i) => ({
  ...d,
  durationInFrames: SCENE_DURATIONS[i],
}));

export { TITLE_DURATION, OUTRO_DURATION, TRANSITION_DURATION };
