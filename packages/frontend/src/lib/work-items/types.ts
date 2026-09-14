/**
 * The standard work items an activity can be started from.
 *
 * There is one mechanism and several libraries: a building job is measured
 * against NRM2's work sections, a road job against the highway-works
 * vocabulary a Nigerian/UK civils bill actually uses. Searching "asphalt" in
 * an NRM2 building library returns nothing, which is why every civil activity
 * on a road contract was being typed from blank (finding F70).
 */
export interface WorkItem {
  name: string;
  type: string;
  /** How the item is measured on a bill — m², m³, m, tonne, number, sum. */
  unit: string;
}

export interface WorkSection {
  code: string;
  group: string;
  items: WorkItem[];
}

export type WorkItemLibraryId = "building" | "civils";

export interface WorkItemLibrary {
  id: WorkItemLibraryId;
  label: string;
  /** The measurement standard the codes belong to, shown on each section. */
  standard: string;
  description: string;
  sections: WorkSection[];
}
