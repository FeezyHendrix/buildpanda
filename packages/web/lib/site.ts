export const site = {
  name: "BuildPanda",
  domain: "buildpanda.io",
  url: "https://buildpanda.io",
  tagline: "Build your home with confidence, from anywhere in the world.",
  description:
    "BuildPanda is the construction management platform that takes Nigerian home builders from inception to completion and handover. Track milestones, release payments against verified progress, manage your budget, documents and contractors, and get independent, third-party inspections and on-site monitoring, whether you live in Lagos or in the diaspora.",
  // Configure these for the live site.
  email: "hello@buildpanda.io",
  phoneDisplay: "+234 800 000 0000",
  appUrl: "https://app.buildpanda.io",
} as const;

export const nav = [
  { label: "Home", href: "/" },
  { label: "Product", href: "/product/" },
  { label: "Construction", href: "/construction/" },
  { label: "About Us", href: "/about/" },
  { label: "Talk to us", href: "/#consultation" },
] as const;

export const projectTypes = [
  "Build a new home",
  "Renovate a property",
  "Invest in real estate",
  "Commercial project",
  "Other",
] as const;
