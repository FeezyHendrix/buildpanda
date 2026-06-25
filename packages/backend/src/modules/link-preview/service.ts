import { generateId } from "../../lib/ids.ts";
import { fetchLinkMetadata, type LinkMetadata } from "./fetcher.ts";
import type { LinkPreviewRepository, LinkPreviewRow } from "./repository.ts";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

function rowToPreview(row: LinkPreviewRow): LinkPreview | null {
  if (!row.ok) return null;
  return {
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image,
    siteName: row.site_name,
  };
}

function isFresh(fetchedAt: Date | string): boolean {
  const ts = typeof fetchedAt === "string" ? Date.parse(fetchedAt) : fetchedAt.getTime();
  return Date.now() - ts < TTL_MS;
}

export function linkPreviewService(repository: LinkPreviewRepository) {
  async function persist(url: string, meta: LinkMetadata | null): Promise<void> {
    await repository.upsert({
      id: generateId("lp"),
      url,
      title: meta?.title ?? null,
      description: meta?.description ?? null,
      image: meta?.image ?? null,
      site_name: meta?.siteName ?? null,
      ok: meta !== null,
    });
  }

  return {
    async preview(url: string): Promise<LinkPreview | null> {
      const cached = await repository.byUrl(url);
      if (cached && isFresh(cached.fetched_at)) return rowToPreview(cached);

      const meta = await fetchLinkMetadata(url);
      await persist(url, meta);
      return meta
        ? { url: meta.url, title: meta.title, description: meta.description, image: meta.image, siteName: meta.siteName }
        : null;
    },
  };
}

export type LinkPreviewService = ReturnType<typeof linkPreviewService>;
