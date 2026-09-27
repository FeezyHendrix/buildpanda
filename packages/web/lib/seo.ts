import type { Metadata } from "next";
import { site } from "./site";

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
 * app/opengraph-image.tsx renders the card, but trailingSlash: true makes
 * Next's own generated URL ("/opengraph-image?<hash>") 308-redirect and mangles
 * the hash into "?<hash>=", so the slashed path is declared explicitly instead
 * and every page then carries an image rather than only the homepage.
 */
const ogImage = {
  url: "/opengraph-image/",
  width: 1200,
  height: 630,
  alt: "BuildPanda: run every project from estimate to handover, on one system",
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
