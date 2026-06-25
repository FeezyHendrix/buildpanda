export type LinkSegment =
  | { kind: "text"; value: string }
  | { kind: "internal"; href: string; label: string }
  | { kind: "external"; href: string; label: string };

// Matches http/https URLs; trailing punctuation is trimmed afterwards so that
// "see https://x.com." doesn't swallow the sentence-ending period.
const URL_REGEX = /https?:\/\/[^\s<]+/g;

const INTERNAL_HOSTS = new Set(["buildpanda.io", "localhost"]);

function isInternalHost(host: string): boolean {
  const bare = host.replace(/:\d+$/, "");
  if (bare === window.location.hostname) return true;
  if (INTERNAL_HOSTS.has(bare)) return true;
  return bare.endsWith(".buildpanda.io");
}

function trimTrailing(url: string): { url: string; trailing: string } {
  const match = /[.,;:!?)\]]+$/.exec(url);
  if (!match) return { url, trailing: "" };
  return { url: url.slice(0, match.index), trailing: url.slice(match.index) };
}

export function parseLinks(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, start) });
    }
    const { url, trailing } = trimTrailing(match[0]);
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (parsed && isInternalHost(parsed.host)) {
      segments.push({ kind: "internal", href: parsed.pathname + parsed.search + parsed.hash, label: url });
    } else if (parsed) {
      segments.push({ kind: "external", href: url, label: url });
    } else {
      segments.push({ kind: "text", value: url });
    }
    if (trailing) segments.push({ kind: "text", value: trailing });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

export function firstExternalUrl(text: string): string | null {
  for (const segment of parseLinks(text)) {
    if (segment.kind === "external") return segment.href;
  }
  return null;
}
