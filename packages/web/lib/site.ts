export const site = {
  name: "BuildPanda",
  domain: "buildpanda.io",
  url: "https://buildpanda.io",
  tagline: "Run every project from estimate to handover, on one system.",
  description:
    "Manage construction estimates, schedules, site inspections and payment records in one place with BuildPanda. Built for contractors and owners. Book a demo.",
  // Configure these for the live site.
  email: "hello@buildpanda.io",
  phones: ["+234 810 991 8957", "+234 906 545 7397"],
  appUrl: "https://app.buildpanda.io",
} as const;

export type NavItem = {
  label: string;
  href?: string;
  children?: ReadonlyArray<{ label: string; href: string; description?: string }>;
};

export const nav: ReadonlyArray<NavItem> = [
  {
    label: "Product",
    children: [
      {
        label: "For contractors",
        href: "/for-contractors/",
        description: "Win more work and deliver it without the chaos.",
      },
      {
        label: "For owners",
        href: "/for-owners/",
        description: "Build with total visibility and control, even from afar.",
      },
    ],
  },
  { label: "Construction", href: "/construction/" },
  { label: "About Us", href: "/about/" },
  { label: "Talk to us", href: "/talk-to-us/" },
] as const;

export const projectTypes = [
  "Build a new home",
  "Renovate a property",
  "Invest in real estate",
  "Commercial project",
  "Other",
] as const;
