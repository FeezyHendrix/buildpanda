import type { Metadata } from "next";
import { LegalArticle } from "@/components/sections/page/legal-article";
import { privacyPolicy } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "privacy",
  title: "Privacy Policy",
  description: "How BuildPanda collects, uses, shares and protects your personal information, and the rights you have over it.",
});

export default function Page() {
  return <LegalArticle doc={privacyPolicy} />;
}
