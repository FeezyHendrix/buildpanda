import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

export const dynamic = "force-static";

// Keep every public route in the sitemap. Omit lastModified until each page
// has a reliable content update date; a build timestamp is not a page edit.
const routes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "for-contractors", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "for-owners", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "construction", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "talk-to-us", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "about", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "data-policy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "terms-of-service", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: canonicalUrl(path),
    changeFrequency,
    priority,
  }));
}
