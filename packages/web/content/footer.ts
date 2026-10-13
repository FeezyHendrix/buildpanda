import { hero } from "./hero";
import { site } from "./site";

export type SocialId = "twitter" | "instagram" | "facebook";

export const footer = {
  description:
    "The construction management platform that takes you from inception to completion and handover, whether you build from Lagos or from the diaspora",
  backedBy: hero.backedBy,
  // PLACEHOLDER targets: /for-contractors, /blog and /terms do not exist in this app yet.
  columns: [
    {
      title: "Product",
      links: [
        { label: "For Contractors", href: "/for-contractors" },
        { label: "For Owners", href: "/for-owners" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Terms & Policies", href: "/terms" },
      ],
    },
  ],
  // PLACEHOLDER: `href` is null until the real profile URLs are supplied; the
  // icon is then shown without a link.
  socials: [
    { id: "twitter", label: `${site.name} on Twitter`, href: null },
    { id: "instagram", label: `${site.name} on Instagram`, href: null },
    { id: "facebook", label: `${site.name} on Facebook`, href: null },
  ] satisfies ReadonlyArray<{ id: SocialId; label: string; href: string | null }>,
  copyright: (year: number) => `© ${year} ${site.name}. All rights reserved.`,
} as const;
