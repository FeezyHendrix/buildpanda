import { notFound } from "next/navigation";
import { SiteDocument } from "@/components/site-document";
import { isLanguage, languages } from "@/content/markets/types";

export { metadata } from "@/lib/site-metadata";

export function generateStaticParams() {
  return languages.filter((language) => language !== "en").map((language) => ({ language }));
}

export default async function InternationalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ language: string }> }) {
  const { language } = await params;
  if (!isLanguage(language) || language === "en") notFound();
  return <SiteDocument language={language}>{children}</SiteDocument>;
}
