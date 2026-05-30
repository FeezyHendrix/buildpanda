import { Readable } from "node:stream";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}
