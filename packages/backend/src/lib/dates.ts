export function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}
