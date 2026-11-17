import { productFacts, productFactsPath } from "@/content/product-facts";
import { languages, type Language } from "@/content/markets/types";
import { canonicalUrl, pageMetadata } from "./seo";

export function productFactsAlternates(): Record<string, string> {
  return Object.fromEntries([
    ["x-default", canonicalUrl(productFactsPath("en"))],
    ...languages.map((language) => [language, canonicalUrl(productFactsPath(language))]),
  ]);
}

export function productFactsMetadata(language: Language) {
  const copy = productFacts[language];
  const metadata = pageMetadata({ path: productFactsPath(language), title: copy.title, description: copy.description, socialTitle: copy.title });
  return {
    ...metadata,
    title: { absolute: copy.title },
    alternates: { canonical: canonicalUrl(productFactsPath(language)), languages: productFactsAlternates() },
    openGraph: { ...metadata.openGraph, locale: language },
  };
}
