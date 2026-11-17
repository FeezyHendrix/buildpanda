import { notFound } from "next/navigation";
import { ProductFactsPage } from "@/components/sections/markets/product-facts-page";
import { isLanguage } from "@/content/markets/types";
import { productFactsMetadata } from "@/lib/product-facts-seo";

type Params = { params: Promise<{ language: string }> };

export async function generateMetadata({ params }: Params) {
  const { language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return productFactsMetadata(language);
}

export default async function Page({ params }: Params) {
  const { language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return <ProductFactsPage language={language} />;
}
