import type { TourStep } from "@/hooks/use-tour";

export const CONSTRUCTION_TOUR_KEY = "construction-dashboard";
export const SALES_TOUR_KEY = "sales-dashboard";

export const CONSTRUCTION_TOUR_STEPS: TourStep[] = [
  {
    target: "construction-progress",
    title: "Track your build at a glance",
    body: "Your overall construction progress and health update in real time as work is logged and verified on site.",
    placement: "bottom",
  },
  {
    target: "construction-budget",
    title: "Stay on budget",
    body: "See how much of your budget has been used against the total, so spend never gets ahead of the plan.",
    placement: "bottom",
  },
  {
    target: "construction-approvals",
    title: "Act on what needs you",
    body: "Pending approvals show up here. Clear them to keep payments and milestones moving.",
    placement: "bottom",
  },
  {
    target: "construction-timeline",
    title: "Follow the project timeline",
    body: "Each phase — from foundation to handover — is laid out here so you always know what comes next.",
    placement: "top",
  },
  {
    target: "project-nav",
    title: "Everything in one place",
    body: "Use the sidebar to manage updates, finances, documents, inspections and your whole site from one project.",
    placement: "right",
  },
];

export const SALES_TOUR_STEPS: TourStep[] = [
  {
    target: "sales-metrics",
    title: "Your pipeline at a glance",
    body: "Pipeline value, win rate and what's awaiting a client reply — your sales health in one row.",
    placement: "bottom",
  },
  {
    target: "sales-funnel",
    title: "See where deals stand",
    body: "The funnel breaks your proposals down by status, so you can spot what to push next.",
    placement: "bottom",
  },
  {
    target: "sales-attention",
    title: "Never miss a follow-up",
    body: "Proposals expiring soon and leads going quiet surface here so nothing slips through the cracks.",
    placement: "left",
  },
  {
    target: "sales-new",
    title: "Win the work",
    body: "Create a proposal, build an estimate, and convert an accepted proposal into a live construction project.",
    placement: "bottom",
  },
];
