const SECRET_KEY =
  /password|passphrase|secret|token|authorization|cookie|credential|api[-_]?key|signature|webhook|session(?!Id)|body|payload|prompt|content|email|phone|address|bank|card|file(name|path)?|sql|binding|query/i;
const SENSITIVE_SEGMENTS =
  "invite|invitations|reset-password|verify-email|public|share|shared|token|accept-invite";
const SENSITIVE_PATH = new RegExp(`\\/(${SENSITIVE_SEGMENTS})(\\/[^\\s#?]*)?`, "gi");
const SENSITIVE_PATH_IN_TEXT = new RegExp(
  `\\/(${SENSITIVE_SEGMENTS})(?:\\/[^\\s?#"'<>)]*)?`,
  "gi",
);

export function safePath(value: string): string {
  try {
    const url = new URL(value, "https://local.invalid");
    if (!["http:", "https:"].includes(url.protocol))
      return `[${url.protocol.slice(0, -1)} resource]`;
    return url.pathname.replace(SENSITIVE_PATH, "/$1/[redacted]").slice(0, 400);
  } catch {
    return "[invalid path]";
  }
}
export function redactText(value: string, limit = 2000): string {
  return value
    .replace(/\bdata:[^\s"'<>)]*/gi, "[redacted data resource]")
    .replace(/https?:\/\/[^\s<>"'`]+/gi, (url) => {
      if (/hooks\.slack(?:-gov)?\.com/i.test(url)) return "[redacted webhook]";
      try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}${safePath(url)}`;
      } catch {
        return "[redacted URL]";
      }
    })
    .replace(/(\/[^\s?"'<>]+)\?[^\s"'<>]*/g, "$1")
    .replace(SENSITIVE_PATH_IN_TEXT, "/$1/[redacted]")
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
      /(["']?(?:password|secret|token|authorization|cookie|api[-_]?key|signature|credential|private[-_]?key|bank[-_]?account|iban|routing[-_]?number|ssn|card[-_]?number|phone|sessionId)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:sk|pk|xox[baprs])[-_][A-Za-z0-9_-]{8,}/g, "[redacted key]")
    .replace(
      /(\b(?:insert into|update|select|delete from)\b[^\n]*?\s-\s)/gi,
      "[database statement redacted] - ",
    )
    .replace(/\b(?:\+?\d[\d ()-]{8,}\d)\b/g, "[redacted number]")
    .slice(0, limit);
}
export function safeTags(
  value: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const tags: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value ?? {}).slice(0, 20)) {
    if (
      SECRET_KEY.test(key) ||
      !/^(area|source|operation|queue|jobId|projectId|orgId|organizationId|provider|model|statusCode|attemptsMade|mode|phase|code|lifecycle|workerId|pid)$/.test(
        key,
      )
    )
      continue;
    if (typeof item === "string") tags[key] = redactText(item, 160);
    else if (
      (typeof item === "number" && Number.isFinite(item)) ||
      typeof item === "boolean"
    )
      tags[key] = item;
  }
  return tags;
}
export function errorDetails(error: unknown) {
  const object =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : undefined;
  const candidate =
    error instanceof Error
      ? error
      : new Error(
          typeof error === "string"
            ? error
            : typeof object?.message === "string"
              ? object.message
              : "A non-Error value was reported",
        );
  if (!(error instanceof Error) && object) {
    if (typeof object.name === "string") candidate.name = object.name;
    if (typeof object.stack === "string") candidate.stack = object.stack;
  }
  const causes: string[] = [],
    seen = new Set<unknown>();
  let cause: unknown = candidate.cause;
  while (cause && causes.length < 3 && !seen.has(cause)) {
    seen.add(cause);
    causes.push(
      redactText(
        cause instanceof Error
          ? `${cause.name}: ${cause.message}\n${cause.stack ?? ""}`
          : String(cause),
        2500,
      ),
    );
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return {
    name: redactText(candidate.name, 100),
    message: redactText(candidate.message),
    stack: redactText(candidate.stack ?? "", 12000),
    causes,
  };
}
