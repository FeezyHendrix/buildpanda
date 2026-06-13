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
    id: "dashboard",
    src: "shots/14-dashboard.png",
    url: "app.buildpanda.io/sales",
    title: "Your whole pipeline, live",
    subtitle: "Pipeline value, win rate and what needs you today, all at a glance.",
    from: { x: 0.5, y: 0.6 },
    click: { x: 0.1, y: 0.114 },
  },
  {
    id: "suite",
    src: "shots/03-suite-switcher.png",
    url: "app.buildpanda.io/sales",
    title: "One login, two suites",
    subtitle: "Switch between pre-construction sales and live construction delivery.",
    from: { x: 0.1, y: 0.12 },
    click: { x: 0.14, y: 0.31 },
  },
  {
    id: "leads",
    src: "shots/04-leads.png",
    url: "app.buildpanda.io/sales/leads",
    title: "Never lose an enquiry",
    subtitle: "Capture every lead and move it from new to won.",
    from: { x: 0.14, y: 0.31 },
    click: { x: 0.051, y: 0.272 },
  },
  {
    id: "proposals",
    src: "shots/05-proposals.png",
    url: "app.buildpanda.io/sales/proposals",
    title: "Every deal, end to end",
    subtitle: "Proposals flow from new, to sent, to accepted, to converted.",
    from: { x: 0.051, y: 0.272 },
    click: { x: 0.35, y: 0.522 },
  },
  {
    id: "overview",
    src: "shots/06-workspace-overview.png",
    url: "app.buildpanda.io/sales/proposals/BP-0004",
    title: "A workspace, not a form",
    subtitle: "Client, brief, activity and one-click actions in one place.",
    from: { x: 0.35, y: 0.522 },
    click: { x: 0.352, y: 0.215 },
  },
  {
    id: "estimate",
    src: "shots/07-estimate.png",
    url: "app.buildpanda.io/sales/proposals/BP-0004",
    title: "Price it with precision",
    subtitle: "Line-item estimates with contingency, tax and a payment schedule.",
    from: { x: 0.352, y: 0.215 },
    click: { x: 0.293, y: 0.215 },
  },
  {
    id: "boq",
    src: "shots/08-boq.png",
    url: "app.buildpanda.io/sales/proposals/BP-0004",
    title: "From take-off to price",
    subtitle: "The architect's bill of quantities, priced into your estimate.",
    from: { x: 0.293, y: 0.215 },
    click: { x: 0.246, y: 0.215 },
  },
  {
    id: "plans",
    src: "shots/09-plans.png",
    url: "app.buildpanda.io/sales/proposals/BP-0004",
    title: "Every drawing on hand",
    subtitle: "Architectural, structural and MEP plans, attached to the deal.",
    from: { x: 0.246, y: 0.215 },
    click: { x: 0.5, y: 0.4 },
  },
  {
    id: "public",
    src: "shots/10-public-proposal.png",
    url: "buildpanda.io/p/banana-island",
    title: "Send a proposal that closes",
    subtitle: "Clients review and accept on a polished, branded page.",
    from: { x: 0.5, y: 0.5 },
    click: { x: 0.8, y: 0.22 },
  },
  {
    id: "convert",
    src: "shots/11-convert-cta.png",
    url: "app.buildpanda.io/sales/proposals/BP-0005",
    title: "Accepted? One click.",
    subtitle: "Turn a signed proposal into a live construction project.",
    from: { x: 0.5, y: 0.45 },
    click: { x: 0.225, y: 0.946 },
  },
  {
    id: "project",
    src: "shots/12-project-overview.png",
    url: "app.buildpanda.io/project/overview",
    title: "Hit the ground running",
    subtitle: "Budget, phases and milestones, ready from day one.",
    from: { x: 0.4, y: 0.6 },
    click: { x: 0.1, y: 0.114 },
  },
  {
    id: "construction",
    src: "shots/13-construction-dashboard.png",
    url: "app.buildpanda.io/dashboard",
    title: "Deliver with confidence",
    subtitle: "Track progress, budget and every active build in one view.",
    from: { x: 0.5, y: 0.85 },
    click: { x: 0.4, y: 0.62 },
  },
];

export const SCENES: Scene[] = DEFS.map((d, i) => ({
  ...d,
  durationInFrames: SCENE_DURATIONS[i],
}));

export { TITLE_DURATION, OUTRO_DURATION, TRANSITION_DURATION };
