import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Footer } from "@/components/sections/footer/footer";
import { Navbar } from "@/components/sections/navbar/navbar";
import { Analytics, ConsentBanner } from "@/components/consent";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/content/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { canonicalUrl } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Condensed display face, used only for the hero's lifecycle list.
// NOTE: this is the foundry's trial file; a licensed copy is needed before launch.
const druk = localFont({
  src: "./fonts/DrukXCond-Super-Trial.otf",
  variable: "--font-druk",
  weight: "900",
  display: "swap",
  preload: false,
});

const defaultTitle = `${site.name}: construction management software for Africa`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: defaultTitle, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "construction management software",
    "construction management software Nigeria",
    "construction project management software Africa",
    "building project management app",
    "quantity takeoff software",
    "bill of quantities software",
    "site diary app",
    "construction inspection software",
    "material management construction",
    "build in Nigeria from abroad",
    "diaspora building project Nigeria",
    "BuildPanda",
  ],
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  category: "Construction software",
  alternates: { canonical: canonicalUrl("") },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: canonicalUrl(""),
    siteName: site.name,
    title: defaultTitle,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: defaultTitle, description: site.description },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: { icon: "/favicon.ico", apple: "/logo.png" },
  // Search Console ownership, set per deploy without a code change.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${druk.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
        <Navbar />
        {children}
        <Footer />
        {/* Analytics load only after consent; see components/consent.tsx. */}
        <Analytics measurementId={site.gaMeasurementId} />
        <ConsentBanner />
      </body>
    </html>
  );
}
