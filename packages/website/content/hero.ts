import { navActions } from "./nav";

export const hero = {
  eyebrow: "The construction operating system for Africa",
  headline: ["Run the entire build", "from one system"],
  pitch:
    "BuildPanda connects estimating, project management, site progress, inspections, milestones, and payments into one powerful construction operating system.",
  primaryAction: navActions.demo,
  // PLACEHOLDER target: the "How it works" section is not built yet.
  secondaryAction: { id: "how-it-works", label: "How it works", href: "#how-it-works" },
  backedBy: {
    label: "Backed by",
    logo: { src: "/brand/nvidia-logo.png", alt: "NVIDIA", width: 83, height: 54 },
  },
  frame: {
    width: 1211,
    top: {
      src: "/hero/frame-1.png",
      height: 275,
      alt: "BuildPanda showing a project's “Needs your attention” list: approvals, inspections and payments waiting on a decision.",
    },
    bottom: { src: "/hero/frame-2.png", height: 526 },
    /** Small screens: one cropped image that runs off the right edge. */
    mobile: { src: "/hero/hero-mobile.png", width: 386, height: 372 },
  },
} as const;
