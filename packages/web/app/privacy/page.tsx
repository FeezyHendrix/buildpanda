import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LegalArticle } from "@/components/legal-article";
import { privacyPolicy } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  path: "privacy",
  title: "Privacy Policy",
  description:
    "How BuildPanda collects, uses, shares and protects your personal information.",
});

export default function PrivacyPage() {
  return <LegalArticle doc={privacyPolicy} />;
}
