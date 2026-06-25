import type { Knex } from "knex";

export interface LinkPreviewRow {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  ok: boolean;
  fetched_at: Date | string;
}

export interface NewLinkPreviewRecord {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  ok: boolean;
}

export function linkPreviewRepository(db: Knex) {
  return {
    byUrl(url: string): Promise<LinkPreviewRow | undefined> {
      return db<LinkPreviewRow>("link_previews").where({ url }).first();
    },

    async upsert(record: NewLinkPreviewRecord): Promise<void> {
      await db("link_previews")
        .insert({ ...record, fetched_at: new Date().toISOString() })
        .onConflict("url")
        .merge({
          title: record.title,
          description: record.description,
          image: record.image,
          site_name: record.site_name,
          ok: record.ok,
          fetched_at: new Date().toISOString(),
        });
    },
  };
}

export type LinkPreviewRepository = ReturnType<typeof linkPreviewRepository>;
