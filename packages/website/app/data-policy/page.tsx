import type { Metadata } from "next";
import { LegalArticle } from "@/components/sections/page/legal-article";
import { dataPolicy } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "data-policy",
  title: "Data Policy",
  description: "How BuildPanda stores, secures and retains project data, and how customers can export or delete it.",
});

export default function Page() {
  return <LegalArticle doc={dataPolicy} />;
}
