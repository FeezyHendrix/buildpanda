import { buildInNigeriaFromAbroad } from "./build-in-nigeria-from-abroad";
import { constructionSoftwareForContractors } from "./construction-software-for-contractors";
import { materialTracking } from "./material-tracking";
import { siteDiary } from "./site-diary";
import type { Guide } from "./types";

export type { Guide } from "./types";

/** Every guide, newest first. Adding one here adds it to the index and the sitemap. */
export const guides: ReadonlyArray<Guide> = [
  buildInNigeriaFromAbroad,
  constructionSoftwareForContractors,
  materialTracking,
  siteDiary,
];

export function guideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
