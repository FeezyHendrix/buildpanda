import { BUILDING_WORK_SECTIONS } from "./building";
import { CIVILS_WORK_SECTIONS } from "./civils";
import type { WorkItem, WorkItemLibrary, WorkItemLibraryId, WorkSection } from "./types";

export type { WorkItem, WorkItemLibrary, WorkItemLibraryId, WorkSection };

export const WORK_ITEM_LIBRARIES: WorkItemLibrary[] = [
  {
    id: "civils",
    label: "Civils & roads",
    standard: "Road works",
    description:
      "Highway and drainage work items — earthworks, sub-base, surfacing, kerbs, culverts and road furniture.",
    sections: CIVILS_WORK_SECTIONS,
  },
  {
    id: "building",
    label: "Building",
    standard: "NRM2",
    description: "NRM2 building work sections — substructure, frame, envelope, finishes and services.",
    sections: BUILDING_WORK_SECTIONS,
  },
];

export function workItemLibrary(id: WorkItemLibraryId): WorkItemLibrary {
  return WORK_ITEM_LIBRARIES.find((library) => library.id === id) ?? WORK_ITEM_LIBRARIES[1]!;
}

/**
 * A road job is offered the road library first. `civil` is the project type a
 * highway contract is set up as; everything else measures like a building.
 * The picker still lets the user switch — a civil project can have a site
 * office to build, and a building job can have an access road.
 */
export function defaultLibraryForProjectType(
  projectType: string | null | undefined,
): WorkItemLibraryId {
  return projectType === "civil" ? "civils" : "building";
}

/** Sections whose group or items match the query, items already narrowed. */
export function filterSections(sections: WorkSection[], query: string): WorkSection[] {
  const term = query.trim().toLowerCase();
  if (!term) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.type.toLowerCase().includes(term) ||
          section.group.toLowerCase().includes(term),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** How many items in a library match — used to point at the other library. */
export function countMatches(library: WorkItemLibrary, query: string): number {
  return filterSections(library.sections, query).reduce(
    (total, section) => total + section.items.length,
    0,
  );
}
