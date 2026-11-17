import { notFound } from "next/navigation";
import { CountryPage } from "@/components/sections/markets/country-page";
import { publishedMarkets } from "@/content/markets";
import { marketMetadata } from "@/lib/market-seo";

type Params = { params: Promise<{ country: string }> };

export function generateStaticParams() {
  return publishedMarkets.map((market) => ({ country: market.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { country } = await params;
  const market = publishedMarkets.find((entry) => entry.slug === country);
  if (!market) notFound();
  return marketMetadata("en", market);
}

export default async function Page({ params }: Params) {
  return <CountryPage country={(await params).country} />;
}
