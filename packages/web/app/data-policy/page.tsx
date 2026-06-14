import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { dataPolicy } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Policy",
  description:
    "How BuildPanda handles, secures and gives you control over the project data you put into the platform.",
  alternates: { canonical: "https://buildpanda.io/data-policy" },
};

export default function DataPolicyPage() {
  return <LegalArticle doc={dataPolicy} />;
}
