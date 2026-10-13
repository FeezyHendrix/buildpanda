import type { MetadataRoute } from "next";
import { guides } from "@/content/guides";
import { canonicalUrl } from "@/lib/seo";

export const dynamic = "force-static";

// Every public page. lastModified is given only where a real content date
// exists (the guides); a build timestamp is not a page edit.
const pages = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "for-owners", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "talk-to-us", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "blog", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "about", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "data-policy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "terms-of-service", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...pages.map(({ path, priority, changeFrequency }) => ({ url: canonicalUrl(path), changeFrequency, priority })),
    ...guides.map((guide) => ({
      url: canonicalUrl(`blog/${guide.slug}`),
      lastModified: guide.updated ?? guide.published,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
