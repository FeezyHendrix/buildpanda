import type { MetadataRoute } from "next";
import { guides } from "@/content/guides";
import { canonicalUrl } from "@/lib/seo";
import { marketPath, publishedMarkets } from "@/content/markets";
import { languages } from "@/content/markets/types";
import { marketAlternates } from "@/lib/market-seo";
import { productFactsDate, productFactsPath } from "@/content/product-facts";
import { productFactsAlternates } from "@/lib/product-facts-seo";

export const dynamic = "force-static";

// Every public page. lastModified is given only where a real content date
// exists (the guides); a build timestamp is not a page edit.
const pages = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "for-contractors", priority: 0.9, changeFrequency: "monthly" as const },
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
    ...languages.map((language) => ({
      url: canonicalUrl(productFactsPath(language)),
      lastModified: productFactsDate,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      alternates: { languages: productFactsAlternates() },
    })),
    ...languages.flatMap((language) => [undefined, ...publishedMarkets].map((market) => ({
      url: canonicalUrl(marketPath(language, market)),
      changeFrequency: "monthly" as const,
      priority: market ? 0.7 : 0.8,
      alternates: { languages: marketAlternates(market) },
    }))),
    ...guides.map((guide) => ({
      url: canonicalUrl(`blog/${guide.slug}`),
      lastModified: guide.updated ?? guide.published,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
