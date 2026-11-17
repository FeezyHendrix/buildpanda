import Link from "next/link";
import { marketCopy } from "@/content/markets/copy";
import { marketPath } from "@/content/markets";
import type { Market } from "@/content/markets/countries";
import { languages, type Language } from "@/content/markets/types";
import { productFactsPath } from "@/content/product-facts";

const names: Record<Language, string> = { en: "English", fr: "Français", ar: "العربية", pt: "Português" };

export function LanguageLinks({ language, market, destination = "market" }: { language: Language; market?: Market; destination?: "market" | "product-facts" }) {
  return (
    <nav aria-label={marketCopy[language].languages} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {languages.map((target) => (
        <Link key={target} href={`/${destination === "product-facts" ? productFactsPath(target) : marketPath(target, market)}/`} hrefLang={target} lang={target}
          aria-current={target === language ? "page" : undefined}
          className="inline-flex min-h-11 items-center underline underline-offset-4 aria-[current=page]:font-bold">
          {names[target]}
        </Link>
      ))}
    </nav>
  );
}
