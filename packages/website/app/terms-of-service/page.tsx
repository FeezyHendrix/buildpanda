import type { Metadata } from "next";
import { LegalArticle } from "@/components/sections/page/legal-article";
import { termsOfService } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "terms-of-service",
  title: "Terms of Service",
  description: "The terms that govern your use of the BuildPanda website, web app and mobile app.",
});

export default function Page() {
  return <LegalArticle doc={termsOfService} />;
}
