import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Search crawlers share public access. Training policies remain independent.
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: ["OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"], allow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
