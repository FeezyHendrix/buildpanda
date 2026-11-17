import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { LocalizedChrome } from "@/components/sections/markets/localized-chrome";
import type { Language } from "@/content/markets/types";
import { Footer } from "@/components/sections/footer/footer";
import { Navbar } from "@/components/sections/navbar/navbar";
import { Analytics, ConsentBanner } from "@/components/consent";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/content/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Condensed display face, used only for the hero's lifecycle list.
// NOTE: this is the foundry's trial file; a licensed copy is needed before launch.
const druk = localFont({
  src: "../app/fonts/DrukXCond-Super-Trial.otf",
  variable: "--font-druk",
  weight: "900",
  display: "swap",
  preload: false,
});

export function SiteDocument({ children, language = "en" }: { children: React.ReactNode; language?: Language }) {
  return (
    <html lang={language} dir={language === "ar" ? "rtl" : "ltr"} className={`${inter.variable} ${druk.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">
          {{ en: "Skip to content", fr: "Aller au contenu", ar: "انتقل إلى المحتوى", pt: "Saltar para o conteúdo" }[language]}
        </a>
        <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
        {language === "en" ? <><Navbar />{children}<Footer /></> : <LocalizedChrome language={language}>{children}</LocalizedChrome>}
        {/* Analytics load only after consent; see components/consent.tsx. */}
        <Analytics measurementId={site.gaMeasurementId} />
        <ConsentBanner language={language} />
      </body>
    </html>
  );
}
