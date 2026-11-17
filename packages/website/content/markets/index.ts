import { markets, type Market } from "./countries";
import { en } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";
import { pt } from "./pt";
import { marketResources as initialResources, type Language, type MarketGuide } from "./types";
import { expandedGuides } from "./expanded-guides";
import { marketProfiles } from "./profiles";

export const marketGuides: Record<Language, Readonly<Record<string, MarketGuide>>> = {
  en: { ...en, ...expandedGuides("en", markets) },
  fr: { ...fr, ...expandedGuides("fr", markets) },
  ar: { ...ar, ...expandedGuides("ar", markets) },
  pt: { ...pt, ...expandedGuides("pt", markets) },
};

export const marketResources: Readonly<Record<string, { name: string; url: string }>> = {
  ...initialResources,
  ...Object.fromEntries(marketProfiles.map((profile) => [profile.code, profile.resource])),
};

// Only complete, locally sourced guides enter routes, language links and sitemap.
export const publishedMarkets = markets.filter((market) => Object.hasOwn(marketGuides.en, market.code));

export function marketName(market: Market, language: Language): string {
  return language === "en" ? market.name : new Intl.DisplayNames([language], { type: "region" }).of(market.code) ?? market.name;
}

export function marketPath(language: Language, market?: Market): string {
  const root = language === "en" ? "africa" : `${language}/africa`;
  return market ? `${root}/${market.slug}` : root;
}
