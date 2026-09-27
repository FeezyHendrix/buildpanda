/** Match every word across human-readable fields, including accented names. */
export function matchesSearch(query: string, fields: readonly (string | number | null | undefined)[]): boolean {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const text = normalize(fields.filter((field) => field != null).join(" "));
  return words.every((word) => text.includes(word));
}
