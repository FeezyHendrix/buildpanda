import { notFound } from "next/navigation";
import { CountryPage } from "@/components/sections/markets/country-page";
import { publishedMarkets } from "@/content/markets";
import { isLanguage } from "@/content/markets/types";
import { marketMetadata } from "@/lib/market-seo";

type Params = { params: Promise<{ country: string; language: string }> };

export function generateStaticParams() {
  return publishedMarkets.map((market) => ({ country: market.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { country, language } = await params;
  const market = publishedMarkets.find((entry) => entry.slug === country);
  if (!market || !isLanguage(language) || language === "en") notFound();
  return marketMetadata(language, market);
}

export default async function Page({ params }: Params) {
  const { country, language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return <CountryPage language={language} country={country} />;
}
