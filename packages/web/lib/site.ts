export const site = {
  name: "BuildPanda",
  domain: "buildpanda.io",
  url: "https://buildpanda.io",
  tagline: "The Construction OS for modern builders, from first enquiry to final handover.",
  description:
    "BuildPanda is the Construction OS that runs your entire build. Win the work with proposals and accurate estimates, convert a signed proposal into a live project, then deliver it with milestones, verified payments, documents and independent inspections, from first enquiry to final handover.",
  // Configure these for the live site.
  email: "hello@buildpanda.io",
  phones: ["+234 810 991 8957", "+234 906 545 7397"],
  appUrl: "https://app.buildpanda.io",
} as const;

export const nav = [
  { label: "Home", href: "/" },
  { label: "Product", href: "/product/" },
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
