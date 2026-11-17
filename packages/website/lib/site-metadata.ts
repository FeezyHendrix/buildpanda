import type { Metadata } from "next";
import { site } from "@/content/site";
import { canonicalUrl, ogImage } from "./seo";

const defaultTitle = `${site.name}: construction management software for Africa`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: defaultTitle, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "construction management software",
    "construction project management software Africa",
    "building project management app",
    "quantity takeoff software",
    "bill of quantities software",
    "site diary app",
    "construction inspection software",
    "material management construction",
    "remote construction project management",
    "BuildPanda",
  ],
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  category: "Construction software",
  alternates: { canonical: canonicalUrl("") },
  openGraph: {
    type: "website",
    locale: "en",
    url: canonicalUrl(""),
    siteName: site.name,
    title: defaultTitle,
    description: site.description,
    images: [ogImage],
  },
  twitter: { card: "summary_large_image", title: defaultTitle, description: site.description, images: [ogImage.url] },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: {
    icon: { url: "/favicon.png", type: "image/png", sizes: "192x192" },
    apple: { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
  },
  // Public ownership tokens, supplied at build time for each verified account.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "F939A18B18E97F1FB478642AD51DF0F5" },
  },
};
