export function safePath(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol))
      return `[${url.protocol.slice(0, -1)} resource]`;
    return url.pathname
      .replace(
        /\/(invite|invitations|reset-password|verify-email|public|share|shared|token|accept-invite)(\/[^#?]*)?/gi,
        "/$1/[redacted]",
      )
      .slice(0, 400);
  } catch {
    return "[invalid path]";
  }
}
export function safeText(value: string, limit = 2000): string {
  return value
    .replace(/\bdata:[^\s"'<>)]*/gi, "[redacted data resource]")
    .replace(/https?:\/\/[^\s<>"'`]+/gi, (url) => {
      if (/hooks\.slack(?:-gov)?\.com/i.test(url)) return "[redacted webhook]";
      try {
        return `${new URL(url).origin}${safePath(url)}`;
      } catch {
        return "[redacted URL]";
      }
    })
    .replace(/(\/[^\s?"'<>]+)\?[^\s"'<>]*/g, "$1")
    .replace(
      /\/(invite|invitations|reset-password|verify-email|public|share|shared|token|accept-invite)(?:\/[^\s?#"'<>)]*)?/gi,
      "/$1/[redacted]",
    )
    .replace(
      /\b(cookie|set-cookie|authorization)\s*:\s*[^\r\n]+/gi,
      "$1: [redacted]",
    )
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/gi, "$1 [redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted token]",
    )
    .replace(
      /(["']?(?:password|secret|token|authorization|cookie|api[-_]?key|signature|credential|private[-_]?key|bank[-_]?account|iban|routing[-_]?number|ssn|card[-_]?number|phone)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:sk|pk|xox[baprs])[-_][A-Za-z0-9_-]{8,}/g, "[redacted key]")
    .replace(/\b(?:\+?\d[\d ()-]{8,}\d)\b/g, "[redacted number]")
    .slice(0, limit);
}
export function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  const object =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  return new Error(
    typeof value === "string"
      ? value
      : typeof object?.message === "string"
        ? object.message
        : "A non-Error value was reported",
  );
}
