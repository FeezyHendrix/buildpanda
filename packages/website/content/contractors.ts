import { site } from "./site";

export type ContractorWinId = "leads" | "proposals" | "handoff";

export type SolutionId = "daily-log" | "build-stages" | "tasks" | "project-chart" | "materials" | "budget";

/** Every solutions screenshot shares one size: a browser window cropped at its right and bottom. */
const SOLUTION_IMAGE = { width: 1836, height: 1743 } as const;

export const contractors = {
  meta: {
    title: "Construction software for contractors and builders",
    description:
      "The software contractors run their own builds on: win work with professional proposals, then manage the project, the schedule and the finances from a single dashboard.",
  },
  hero: {
    eyebrow: "For Contractors & Builders",
    headline: "Win more work and deliver it without the chaos",
    body: "This is the software you run your own builds on. Win work with professional proposals, then manage the project, the schedule and the finances from a single dashboard",
    // The app is where a contractor signs up.
    action: { label: "Get Started", href: site.appUrl },
    image: {
      src: "/contractors/hero.png",
      width: 2085,
      height: 2058,
      alt: "BuildPanda's materials and equipment screen for Ebony Plaza: open material orders, committed spend and the list of ordered materials with quantities and unit rates.",
    },
  },
  win: {
    headline: "Win the work",
    body: "Give your clients a polished, professional experience from their very first enquiry.",
    items: [
      {
        id: "leads",
        title: "Leads and Pipelines",
        description: "Capture every enquiry and track it from new to won so no opportunity is lost.",
      },
      {
        id: "proposals",
        title: "Proposals and Estimates",
        description:
          "Build precise, line-by-line estimates and bills of quantities. Send branded proposals clients can accept online.",
      },
      {
        id: "handoff",
        title: "One-click handoff",
        description:
          "Turn an accepted proposal into a live construction project instantly, with budget and milestones ready to go.",
      },
    ] satisfies ReadonlyArray<{ id: ContractorWinId; title: string; description: string }>,
  },
  solutions: {
    eyebrow: "Our Solutions",
    headline: "Everything you need",
    // The home page is the product tour.
    action: { label: "Explore Product", href: "/" },
    listLabel: "BuildPanda product areas",
    image: SOLUTION_IMAGE,
    items: [
      {
        id: "daily-log",
        title: "Daily Log",
        description:
          "Keep a clear record of daily site activities, crew attendance, working hours, and progress updates, so nothing happening on-site goes unnoticed.",
        src: "/contractors/solutions-daily-log.png",
        alt: "BuildPanda's daily log for Ebony Plaza: days logged, missed days, total hours and a table of logged days with crew, hours and weather.",
      },
      {
        id: "build-stages",
        title: "Build Stages",
        description:
          "Break your project into manageable stages, track construction progress, and keep every phase organized from start to finish.",
        src: "/contractors/solutions-build-stages.png",
        alt: "BuildPanda's build stages screen: construction progress at 7%, the budget allocated across stages, and six stages from site setup to external works with their status and value.",
      },
      {
        id: "tasks",
        title: "Tasks",
        description:
          "Assign responsibilities, set deadlines, and track tasks in real time to keep your team aligned and work moving forward.",
        src: "/contractors/solutions-tasks.png",
        alt: "BuildPanda's task board with To do, Doing and Done columns, each task showing its priority, assignee and due date.",
      },
      {
        id: "project-chart",
        title: "Project Chart",
        description:
          "Visualize your entire construction timeline, manage schedules, and track milestones to keep your project on course.",
        src: "/contractors/solutions-project-chart.png",
        alt: "BuildPanda's project chart: milestone cost, work items completed, delay cost and timeline shift above a Gantt chart of site setup and substructure tasks.",
      },
      {
        id: "materials",
        title: "Materials & Equipments",
        description:
          "Manage material orders, track deliveries, and monitor costs to ensure your site has everything it needs, when it needs it.",
        src: "/contractors/solutions-materials.png",
        alt: "BuildPanda's materials and equipment screen: open material orders, committed spend and the list of ordered materials with quantities.",
      },
      {
        id: "budget",
        title: "Budget and Invoices",
        description:
          "Stay in control of project finances. Track budgets, manage invoices, and monitor spending across every stage of construction.",
        src: "/contractors/solutions-budget.png",
        alt: "BuildPanda's budget screen: the scheduled contract value, phases priced, and each build stage with its claim state, scheduled value and amount committed.",
      },
    ] satisfies ReadonlyArray<{ id: SolutionId; title: string; description: string; src: string; alt: string }>,
  },
  consultation: {
    id: "book-a-consultation",
    eyebrow: "Book a Consultation",
    headline: "Tell us about your project",
    body: "Tell us about your company and the job you want to run. We will set it up on BuildPanda and walk your team through it, from the first estimate to handover, with no obligation.",
    // Sent with every enquiry, as on the Book a Demo page.
    projectType: "Software demo",
    source: "website:for-contractors",
  },
} as const;
