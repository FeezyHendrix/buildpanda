import type { Metadata } from "next";
import { site } from "@/content/site";

/**
 * next.config.mjs sets trailingSlash: true, so /about 308-redirects to /about/.
 * A canonical without the slash therefore points at a redirect, which is the
 * one thing a canonical must never do. Every URL the site declares about
 * itself is built here so that cannot drift again.
 */
export function canonicalUrl(path: string): string {
  if (path === "" || path === "/") return `${site.url}/`;
  const trimmed = `/${path.replace(/^\/+|\/+$/g, "")}/`;
  return `${site.url}${trimmed}`;
}

/**
 * The social card every page shares: a static file, so its URL is plain and
 * never redirects. 1200x630 JPEG (105 KB, small enough for WhatsApp's preview);
 * the 3600x1890 original is in assets-src/og.
 */
export const ogImage = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "BuildPanda: your entire build, one powerful platform. The materials and equipment screen in a browser window.",
};

interface PageSeo {
  /** Route path, with or without slashes. "" is the homepage. */
  path: string;
  /** Shown in the tab and the search result. The brand is appended by the
   *  layout's title template, so do not repeat it here. */
  title: string;
  description: string;
  /** Overrides the title on social cards, where there is no template and more
   *  room for a full sentence. */
  socialTitle?: string;
}

/**
 * Without this every page shared the site-wide card, so a link to the
 * contractor page and a link to the terms previewed identically.
 */
export function pageMetadata({ path, title, description, socialTitle }: PageSeo): Metadata {
  const url = canonicalUrl(path);
  const social = socialTitle ?? `${title} | ${site.name}`;
  // The layout's title template applies to child segments only, so the root
  // page would otherwise be the one page in the site with no brand in its tab.
  const isHome = path === "" || path === "/";
  return {
    title: isHome ? `${title} | ${site.name}` : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      title: social,
      description,
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title: social, description, images: [ogImage.url] },
  };
}
