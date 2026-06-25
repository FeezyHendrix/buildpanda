import { lookup as dnsLookup } from "node:dns";
import { Agent, request as undiciRequest } from "undici";
import * as cheerio from "cheerio";

export interface LinkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Blocks loopback, private, link-local, CGNAT and cloud-metadata ranges so a
// user-supplied URL can never make the server reach internal infrastructure.
function isBlockedIp(ip: string): boolean {
  if (/^10\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (/^fe[89ab]/.test(v6)) return true;
  if (/^f[cd]/.test(v6)) return true;
  if (v6.startsWith("::ffff:")) return isBlockedIp(v6.slice(7));
  return false;
}

// Hooks undici's own DNS resolution. undici resolves hostnames itself, so the
// only reliable place to pin a validated IP (and defeat DNS rebinding between
// our check and the connect) is inside its lookup. undici always asks with
// `all: true`, so we filter the resolved list and hand back only safe addresses
// in the array form its callback expects.
const safeAgent = new Agent({
  connect: {
    lookup: (hostname, opts, cb) => {
      dnsLookup(hostname, { ...opts, all: true }, (err, addresses) => {
        if (err) return cb(err, []);
        const list = (addresses as unknown as { address: string; family: number }[]).filter(
          (a) => !isBlockedIp(a.address),
        );
        if (list.length === 0) return cb(new Error("SSRF: blocked address"), []);
        cb(null, list);
      });
    },
  },
});

function validateUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!ALLOWED_SCHEMES.has(u.protocol)) return null;
  if (u.username || u.password) return null;
  // A bare IP literal in a blocked range is rejected up front; hostnames are
  // validated at connect time by the agent's lookup hook.
  if (isBlockedIp(u.hostname.replace(/^\[|\]$/g, ""))) return null;
  return u;
}

async function readCapped(body: AsyncIterable<Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > MAX_BYTES) break;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extract(html: string, finalUrl: string): LinkMetadata {
  const $ = cheerio.load(html);
  const meta = (names: string[]): string | null => {
    for (const name of names) {
      const byProp = $(`meta[property="${name}"]`).attr("content");
      if (byProp) return byProp.trim();
      const byName = $(`meta[name="${name}"]`).attr("content");
      if (byName) return byName.trim();
    }
    return null;
  };
  const title = meta(["og:title", "twitter:title"]) ?? $("title").first().text().trim() ?? null;
  return {
    url: finalUrl,
    title: title || null,
    description: meta(["og:description", "twitter:description", "description"]),
    image: meta(["og:image", "twitter:image", "twitter:image:src"]),
    siteName: meta(["og:site_name"]),
  };
}

export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata | null> {
  let current = validateUrl(rawUrl);
  if (!current) return null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Awaited<ReturnType<typeof undiciRequest>>;
    try {
      response = await undiciRequest(current.toString(), {
        method: "GET",
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
        headers: { "user-agent": "BuildPandaBot/1.0 (+link-preview)", accept: "text/html" },
        dispatcher: safeAgent,
      });
    } catch {
      return null;
    }

    const status = response.statusCode;
    if (status >= 300 && status < 400) {
      response.body.destroy();
      const location = response.headers["location"];
      const loc = Array.isArray(location) ? location[0] : location;
      if (!loc) return null;
      const next = validateUrl(new URL(loc, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }

    if (status < 200 || status >= 300) {
      response.body.destroy();
      return null;
    }
    const contentTypeRaw = response.headers["content-type"];
    const contentType = Array.isArray(contentTypeRaw) ? contentTypeRaw[0] ?? "" : contentTypeRaw ?? "";
    if (!/^text\/html\b/i.test(contentType)) {
      response.body.destroy();
      return null;
    }

    const html = await readCapped(response.body);
    return extract(html, current.toString());
  }
  return null;
}
