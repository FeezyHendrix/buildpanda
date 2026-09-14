import type { Metadata } from "next";
import localFont from "next/font/local";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { site } from "@/lib/site";
import { canonicalUrl } from "@/lib/seo";
import { organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import { Analytics, ConsentBanner } from "@/components/consent";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-LTCX5C0F7N";

/**
 * Self-hosted rather than next/font/google. Fetching the face at build time
 * made every build depend on Google being reachable, and the site's own
 * requests depend on a third party at runtime. Both files are the variable
 * font, so one file covers 400 through 800.
 */
const jakarta = localFont({
  src: [
    { path: "../public/fonts/plus-jakarta-sans-latin.woff2", weight: "400 800", style: "normal" },
    { path: "../public/fonts/plus-jakarta-sans-latin-ext.woff2", weight: "400 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: verified construction delivery`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "construction management software",
    "construction project management software Nigeria",
    "payment certificates construction",
    "site inspection software",
    "construction programme and delay tracking",
    "bill of quantities software",
    "extension of time claims",
    "managed construction service Nigeria",
    "build a house in Nigeria from abroad",
    "BuildPanda",
  ],
  authors: [{ name: site.name }],
  alternates: { canonical: canonicalUrl("") },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: canonicalUrl(""),
    siteName: site.name,
    title: `${site.name}: verified construction delivery`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name}: verified construction delivery`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased">
        <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
        <Navbar />
        <main>{children}</main>
        <Footer />
        {/* Analytics load only after consent; see components/consent.tsx. */}
        <Analytics measurementId={GA_MEASUREMENT_ID} />
        <ConsentBanner />
      </body>
    </html>
  );
}
