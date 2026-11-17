import { SiteDocument } from "@/components/site-document";

export { metadata } from "@/lib/site-metadata";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
