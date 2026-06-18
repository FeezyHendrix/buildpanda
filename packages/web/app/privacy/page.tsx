import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { privacyPolicy } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BuildPanda collects, uses, shares and protects your personal information across our construction management platform.",
  alternates: { canonical: "https://buildpanda.io/privacy" },
};

export default function PrivacyPage() {
  return <LegalArticle doc={privacyPolicy} />;
}
