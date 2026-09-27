import type { ProjectTypeCode } from "./types.ts";

/**
 * The wizard's free-text type mapped onto the four kinds of works the app
 * models. A road, drainage or bridge job is `civil`: it has no storeys, no
 * finishes and no house-shaped stage list.
 */
export function toProjectTypeCode(projectType: string): ProjectTypeCode {
  const value = projectType.toLowerCase();
  if (value.includes("renov") || value.includes("refurb")) return "renovation";
  if (
    value.includes("civil") ||
    value.includes("infra") ||
    value.includes("road") ||
    value.includes("bridge") ||
    value.includes("drainage")
  ) {
    return "civil";
  }
  if (value.includes("build") || value.includes("new") || value.includes("house")) return "building";
  return "other";
}
