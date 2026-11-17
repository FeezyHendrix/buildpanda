import Link from "next/link";
import { marketCopy } from "@/content/markets/copy";
import { marketPath } from "@/content/markets";
import type { Language } from "@/content/markets/types";
import { site } from "@/content/site";
import { ConsentReset } from "@/components/consent";
import { productFactsPath } from "@/content/product-facts";

export function LocalizedChrome({ children, language }: { children: React.ReactNode; language: Language }) {
  const copy = marketCopy[language];
  return (
    <>
      <header className="border-b border-line bg-cream text-ink">
        <nav aria-label={copy.allCountries} className="site-container flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href={`/${marketPath(language)}/`} className="text-2xl font-bold" dir="ltr">{site.name}</Link>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link href={`/${marketPath(language)}/`} className="inline-flex min-h-11 items-center underline underline-offset-4">{copy.allCountries}</Link>
            <Link href={`/${productFactsPath(language)}/`} className="inline-flex min-h-11 items-center underline underline-offset-4">{copy.facts}</Link>
            <Link href="/for-contractors/" hrefLang="en" className="inline-flex min-h-11 items-center underline underline-offset-4">{copy.product}</Link>
          </div>
        </nav>
      </header>
      {children}
      <footer className="border-t border-line bg-cream text-ink">
        <div className="site-container flex flex-wrap justify-between gap-6 py-8 text-sm">
          <p>© {new Date().getFullYear()} <bdi>{site.name}</bdi>. {copy.rights}</p>
          <nav aria-label={copy.terms} className="flex flex-wrap gap-5">
            <Link href="/privacy/" hrefLang="en" className="underline underline-offset-4">{copy.privacy}</Link>
            <Link href="/terms-of-service/" hrefLang="en" className="underline underline-offset-4">{copy.terms}</Link>
            <ConsentReset language={language} className="text-sm underline underline-offset-4" />
          </nav>
        </div>
      </footer>
    </>
  );
}
