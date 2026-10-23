import { navActions } from "./nav";

export const hero = {
  eyebrow: "The construction operating system for Africa",
  headline: ["Run the entire build", "from one system"],
  pitch:
    "BuildPanda connects estimating, project management, site progress, inspections, milestones, and payments into one powerful construction operating system.",
  primaryAction: navActions.demo,
  // The product walk-through starts at the takeoff section.
  secondaryAction: { id: "how-it-works", label: "How it works", href: "#how-it-works" },
  backedBy: {
    label: "Backed by",
    // The NVIDIA Inception Program badge, white for the brand-blue hero and footer.
    logo: {
      src: "/brand/nvidia-inception-program-badge-white.svg",
      alt: "BuildPanda is a member of the NVIDIA Inception Program",
      width: 501,
      height: 216,
    },
  },
  frame: {
    // Supplied at 3x the 1211px design width, so the frame stays sharp on retina screens.
    width: 3633,
    top: {
      src: "/hero/frame-1.png",
      height: 825,
      alt: "BuildPanda showing a project's “Needs your attention” list: approvals, inspections and payments waiting on a decision.",
    },
    bottom: { src: "/hero/frame-2.png", height: 1578 },
    /** Small screens: one cropped image that runs off the right edge. */
    mobile: { src: "/hero/hero-mobile.png", width: 386, height: 372 },
  },
} as const;
