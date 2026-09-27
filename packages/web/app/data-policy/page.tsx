import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LegalArticle } from "@/components/legal-article";
import { dataPolicy } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  path: "data-policy",
  title: "Data Policy",
  description:
    "How BuildPanda handles, secures and gives you control over the project data you put into the platform, including how to get it back out.",
});

export default function DataPolicyPage() {
  return <LegalArticle doc={dataPolicy} />;
}
