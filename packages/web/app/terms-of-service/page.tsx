import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { termsOfService } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — BuildPanda",
  description:
    "The terms that govern your access to and use of the BuildPanda construction management platform.",
  alternates: { canonical: "https://buildpanda.io/terms-of-service/" },
};

export default function TermsPage() {
  return <LegalArticle doc={termsOfService} />;
}
