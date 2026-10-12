import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Footer } from "@/components/sections/footer/footer";
import { Navbar } from "@/components/sections/navbar/navbar";
import { site } from "@/content/site";
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

export const metadata: Metadata = {
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${druk.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
