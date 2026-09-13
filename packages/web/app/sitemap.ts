import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * Priority says which pages we would rather rank, not how good they are: the
 * two product pages sit just under the homepage, the legal pages at the floor.
 * /talk-to-us/ and /terms-of-service/ were missing entirely, so nothing linked
 * them for a crawler that entered on a deep page.
 */
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
  const lastModified = new Date();
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
