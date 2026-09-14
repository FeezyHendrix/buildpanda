import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { toIso } from "../../lib/dates.ts";
import type { OtaRepository } from "./repository.ts";
import type {
  Manifest,
  ManifestAsset,
  OtaAsset,
  OtaPlatform,
  OtaUpdateRow,
  PublishManifestInput,
  PublishResult,
} from "./types.ts";

const CONTENT_TYPES: Record<string, string> = {
  js: "application/javascript",
  hbc: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

// The protocol hashes assets with base64url-encoded SHA-256 for integrity, and
// separately keys them by MD5 so the same file always lands at the same URL.
function assetHash(body: Buffer): string {
  return createHash("sha256").update(body).digest("base64url");
}

function assetKey(body: Buffer): string {
  return createHash("md5").update(body).digest("hex");
}

function contentTypeFor(ext: string, isLaunchAsset: boolean): string {
  if (isLaunchAsset) return "application/javascript";
  return CONTENT_TYPES[ext.replace(/^\./, "").toLowerCase()] ?? "application/octet-stream";
}

function parseAssets(row: OtaUpdateRow): OtaAsset[] {
  return typeof row.assets === "string" ? JSON.parse(row.assets) : row.assets;
}

function toManifestAsset(asset: OtaAsset, updateId: string, baseUrl: string): ManifestAsset {
  return {
    hash: asset.hash,
    key: asset.key,
    contentType: asset.contentType,
    fileExtension: asset.fileExtension,
    url: `${baseUrl}/ota/assets/${updateId}/${asset.key}`,
  };
}

export function otaService(repository: OtaRepository) {
  function toManifest(row: OtaUpdateRow, baseUrl: string): Manifest {
    return {
      id: row.id,
      createdAt: toIso(row.created_at),
      runtimeVersion: row.runtime_version,
      launchAsset: {
        hash: row.launch_asset_hash,
        key: row.launch_asset_key,
        contentType: "application/javascript",
        url: `${baseUrl}/ota/assets/${row.id}/${row.launch_asset_key}`,
      },
      assets: parseAssets(row).map((asset) => toManifestAsset(asset, row.id, baseUrl)),
      metadata: {},
      extra: {},
    };
  }

  return {
    async latestManifest(
      platform: OtaPlatform,
      runtimeVersion: string,
      baseUrl: string,
    ): Promise<Manifest | null> {
      const row = await repository.latestFor(platform, runtimeVersion);
      return row ? toManifest(row, baseUrl) : null;
    },

    async findAsset(
      updateId: string,
      key: string,
    ): Promise<{ storagePath: string; contentType: string }> {
      const row = await repository.byId(updateId);
      if (!row) throw new NotFoundError("Update");
      if (key === row.launch_asset_key) {
        return { storagePath: row.launch_asset_path, contentType: "application/javascript" };
      }
      const asset = parseAssets(row).find((candidate) => candidate.key === key);
      if (!asset) throw new NotFoundError("Update asset");
      return { storagePath: asset.storagePath, contentType: asset.contentType };
    },

    async publish(
      input: PublishManifestInput,
      files: Map<string, Buffer>,
    ): Promise<PublishResult> {
      const launchBody = files.get(input.launchAsset.path);
      if (!launchBody) {
        throw new BadRequestError(`Launch asset ${input.launchAsset.path} was not uploaded`);
      }

      const id = randomUUID();
      const stored = await saveStream("ota", Readable.from(launchBody));

      const assets: OtaAsset[] = [];
      for (const descriptor of input.assets) {
        const body = files.get(descriptor.path);
        if (!body) {
          throw new BadRequestError(`Asset ${descriptor.path} was not uploaded`);
        }
        const upload = await saveStream("ota", Readable.from(body));
        assets.push({
          key: assetKey(body),
          hash: assetHash(body),
          contentType: contentTypeFor(descriptor.ext, false),
          fileExtension: descriptor.ext.startsWith(".") ? descriptor.ext : `.${descriptor.ext}`,
          storagePath: upload.storagePath,
        });
      }

      await repository.insert({
        id,
        platform: input.platform,
        runtime_version: input.runtimeVersion,
        launch_asset_key: assetKey(launchBody),
        launch_asset_hash: assetHash(launchBody),
        launch_asset_path: stored.storagePath,
        assets: JSON.stringify(assets),
        commit_sha: input.commitSha ?? null,
      });

      return {
        id,
        platform: input.platform,
        runtimeVersion: input.runtimeVersion,
        assetCount: assets.length,
      };
    },
  };
}

export type OtaService = ReturnType<typeof otaService>;
