import type { Metadata } from "next";
import { marketCopy } from "@/content/markets/copy";
import { marketGuides, marketName, marketPath } from "@/content/markets";
import type { Market } from "@/content/markets/countries";
import { languages, type Language } from "@/content/markets/types";
import { canonicalUrl, pageMetadata } from "./seo";

export function marketAlternates(market?: Market): Record<string, string> {
  return Object.fromEntries([
    ["x-default", canonicalUrl(marketPath("en", market))],
    ...languages.map((language) => [language, canonicalUrl(marketPath(language, market))]),
  ]);
}

export function marketMetadata(language: Language, market?: Market): Metadata {
  const copy = marketCopy[language];
  const title = market ? `${copy.countryTitle} ${marketName(market, language)}` : copy.title;
  const description = market ? marketGuides[language][market.code].description : copy.description;
  const metadata = pageMetadata({ path: marketPath(language, market), title, description });
  return {
    ...metadata,
    alternates: { canonical: canonicalUrl(marketPath(language, market)), languages: marketAlternates(market) },
    openGraph: { ...metadata.openGraph, locale: market ? `${language}_${market.code}` : language },
  };
}
