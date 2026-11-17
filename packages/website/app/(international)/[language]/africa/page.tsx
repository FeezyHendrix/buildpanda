import { notFound } from "next/navigation";
import { AfricaPage } from "@/components/sections/markets/africa-page";
import { isLanguage } from "@/content/markets/types";
import { marketMetadata } from "@/lib/market-seo";

type Params = { params: Promise<{ language: string }> };

export async function generateMetadata({ params }: Params) {
  const { language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return marketMetadata(language);
}

export default async function Page({ params }: Params) {
  const { language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return <AfricaPage language={language} />;
}
