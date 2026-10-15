export function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, maxLength) : null;
}

export function requiredString(value: unknown, maxLength: number, field: string): string {
  const s = optionalString(value, maxLength);
  if (!s) throw new Error(`${field} is required`);
  return s;
}

export function safeLen(json: string): number {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
