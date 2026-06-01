import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/product", "/construction", "/about"];
  return routes.map((route) => ({
    url: `${site.url}${route}/`,
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
