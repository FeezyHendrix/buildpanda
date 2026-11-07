import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LegalArticle } from "@/components/legal-article";
import { termsOfService } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  path: "terms-of-service",
  title: "Terms of Service",
  description:
    "The terms that govern your access to and use of BuildPanda.",
});

export default function TermsPage() {
  return <LegalArticle doc={termsOfService} />;
}
