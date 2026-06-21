import { Readable } from "node:stream";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/index.ts";
import { generateId } from "./ids.ts";

export interface StoredFile {
  storagePath: string;
  sizeBytes: number;
}

let clientPromise: Promise<S3Client> | null = null;

function shouldForcePathStyle(): boolean {
  if (config.storage.forcePathStyle === "true") return true;
  if (config.storage.forcePathStyle === "false") return false;
  return Boolean(config.storage.endpoint);
}

function buildClient(): S3Client {
  const options: S3ClientConfig = {
    region: config.storage.region,
    forcePathStyle: shouldForcePathStyle(),
  };
  if (config.storage.endpoint) {
    options.endpoint = config.storage.endpoint;
  }
  if (config.storage.accessKeyId && config.storage.secretAccessKey) {
    options.credentials = {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    };
  }
  return new S3Client(options);
}

async function ensureBucket(client: S3Client): Promise<void> {
  const bucket = config.storage.bucket;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404 && status !== undefined && status !== 301) {
      throw error;
    }
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const name = (error as Error).name;
    if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
      throw error;
    }
  }
}

async function getClient(): Promise<S3Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = buildClient();
      if (config.storage.ensureBucketOnStartup) {
        await ensureBucket(client);
      }
      return client;
    })();
  }
  return clientPromise;
}

class CountingPassThrough extends Readable {
  bytes = 0;
  constructor(source: NodeJS.ReadableStream) {
    super();
    source.on("data", (chunk: Buffer) => {
      this.bytes += chunk.length;
      this.push(chunk);
    });
    source.on("end", () => this.push(null));
    source.on("error", (err) => this.destroy(err));
  }
  _read(): void {}
}

export async function saveStream(
  ownerId: string,
  data: NodeJS.ReadableStream,
): Promise<StoredFile> {
  const client = await getClient();
  const key = `${ownerId}/${generateId("file")}`;
  const counter = new CountingPassThrough(data);

  const upload = new Upload({
    client,
    params: {
      Bucket: config.storage.bucket,
      Key: key,
      Body: counter,
      ...(config.storage.serverSideEncryption ? { ServerSideEncryption: "AES256" } : {}),
    },
  });
  await upload.done();

  return { storagePath: key, sizeBytes: counter.bytes };
}

export async function openStoredFile(
  storagePath: string,
): Promise<NodeJS.ReadableStream> {
  const client = await getClient();
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.storage.bucket, Key: storagePath }),
  );
  if (!result.Body) {
    throw new Error(`File body missing for ${storagePath}`);
  }
  return result.Body as NodeJS.ReadableStream;
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  const client = await getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: storagePath }),
  );
}

export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function makeStorageKey(ownerId: string, prefix = "file"): string {
  return `${ownerId}/${generateId(prefix)}`;
}

type PresignableCommand = Parameters<typeof getSignedUrl>[1];

function presign(
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand | UploadPartCommand,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(
    client as unknown as Parameters<typeof getSignedUrl>[0],
    command as unknown as PresignableCommand,
    { expiresIn },
  );
}

export async function getUploadUrl(
  storagePath: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const client = await getClient();
  return presign(
    client,
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: storagePath,
      ContentType: contentType,
    }),
    expiresInSeconds,
  );
}

export async function getDownloadUrl(
  storagePath: string,
  expiresInSeconds = 900,
): Promise<string> {
  const client = await getClient();
  return presign(
    client,
    new GetObjectCommand({ Bucket: config.storage.bucket, Key: storagePath }),
    expiresInSeconds,
  );
}

export interface MultipartPartUrl {
  partNumber: number;
  url: string;
}

export async function createMultipartUpload(
  storagePath: string,
  contentType: string,
): Promise<string> {
  const client = await getClient();
  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.storage.bucket,
      Key: storagePath,
      ContentType: contentType,
      ...(config.storage.serverSideEncryption ? { ServerSideEncryption: "AES256" as const } : {}),
    }),
  );
  if (!result.UploadId) throw new Error("S3 did not return an UploadId");
  return result.UploadId;
}

export async function getPartUploadUrls(
  storagePath: string,
  uploadId: string,
  partCount: number,
  expiresInSeconds = 3600,
): Promise<MultipartPartUrl[]> {
  const client = await getClient();
  const urls: MultipartPartUrl[] = [];
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const url = await presign(
      client,
      new UploadPartCommand({
        Bucket: config.storage.bucket,
        Key: storagePath,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      expiresInSeconds,
    );
    urls.push({ partNumber, url });
  }
  return urls;
}

export async function completeMultipartUpload(
  storagePath: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const client = await getClient();
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.storage.bucket,
      Key: storagePath,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

export async function abortMultipartUpload(
  storagePath: string,
  uploadId: string,
): Promise<void> {
  const client = await getClient();
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.storage.bucket,
      Key: storagePath,
      UploadId: uploadId,
    }),
  );
}
