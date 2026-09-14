export const OTA_PLATFORMS = ["android", "ios"] as const;
export type OtaPlatform = (typeof OTA_PLATFORMS)[number];

export interface OtaAsset {
  key: string;
  hash: string;
  contentType: string;
  fileExtension: string;
  storagePath: string;
}

export interface OtaUpdateRow {
  id: string;
  platform: OtaPlatform;
  runtime_version: string;
  launch_asset_key: string;
  launch_asset_hash: string;
  launch_asset_path: string;
  assets: OtaAsset[] | string;
  commit_sha: string | null;
  created_at: Date | string;
}

export interface NewOtaUpdateRecord {
  id: string;
  platform: OtaPlatform;
  runtime_version: string;
  launch_asset_key: string;
  launch_asset_hash: string;
  launch_asset_path: string;
  assets: string;
  commit_sha: string | null;
}

export interface ManifestAsset {
  hash: string;
  key: string;
  contentType: string;
  fileExtension?: string;
  url: string;
}

export interface Manifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: Record<string, string>;
  extra: Record<string, unknown>;
}

/** One file of an `expo export`, as described by the CI publish script. */
export interface PublishFileDescriptor {
  path: string;
  ext: string;
}

export interface PublishManifestInput {
  platform: OtaPlatform;
  runtimeVersion: string;
  commitSha?: string | null;
  launchAsset: PublishFileDescriptor;
  assets: PublishFileDescriptor[];
}

export interface StoredUpload {
  path: string;
  body: Buffer;
}

export interface PublishResult {
  id: string;
  platform: OtaPlatform;
  runtimeVersion: string;
  assetCount: number;
}
