import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { site } from "@/lib/site";
import { canonicalUrl } from "@/lib/seo";
import { organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-LTCX5C0F7N";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
        {/* Google Analytics (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
