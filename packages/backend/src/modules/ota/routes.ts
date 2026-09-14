import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, ForbiddenError } from "../../lib/errors.ts";
import { openStoredFile } from "../../lib/file-storage.ts";
import { publicTokenRateLimit } from "../../plugins/security.ts";
import { otaRepository } from "./repository.ts";
import { otaService } from "./service.ts";
import { OTA_PLATFORMS, type OtaPlatform, type PublishManifestInput } from "./types.ts";

const assetParams = {
  type: "object",
  required: ["id", "key"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    key: { type: "string", minLength: 1 },
  },
} as const;

function isPlatform(value: unknown): value is OtaPlatform {
  return typeof value === "string" && OTA_PLATFORMS.includes(value as OtaPlatform);
}

// Asset URLs must share the manifest's origin, and Railway terminates TLS in
// front of the app, so the forwarded headers are the only truthful source.
function originOf(request: FastifyRequest): string {
  const proto = (request.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const host = (request.headers["x-forwarded-host"] as string | undefined) ?? request.headers.host;
  return `${proto ?? request.protocol}://${host}`;
}

function assertPublisher(request: FastifyRequest): void {
  const expected = config.ota.publishToken;
  if (!expected) throw new ForbiddenError("OTA publishing is not configured");
  const provided = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError("Invalid publish token");
  }
}

const otaRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.ota.maxAssetBytes, files: 1000 },
  });

  const service = otaService(otaRepository(fastify.db));

  // The Expo Updates protocol endpoint. Unauthenticated by necessity: the app
  // checks for updates before anyone signs in.
  fastify.get(
    "/ota/manifest",
    { config: { rateLimit: publicTokenRateLimit } },
    async (request, reply) => {
      const platform = request.headers["expo-platform"];
      const runtimeVersion = request.headers["expo-runtime-version"];

      reply
        .header("expo-protocol-version", "1")
        .header("expo-sfv-version", "0")
        .header("cache-control", "private, max-age=0");

      if (!isPlatform(platform)) return reply.status(400).send({ error: "Unsupported platform" });
      if (typeof runtimeVersion !== "string" || runtimeVersion.length === 0) {
        return reply.status(400).send({ error: "Missing expo-runtime-version" });
      }

      const manifest = await service.latestManifest(platform, runtimeVersion, originOf(request));
      if (!manifest) return reply.status(204).send();

      return reply.type("application/json").send(manifest);
    },
  );

  // Assets are immutable at their URL, which the protocol requires, so they can
  // be cached indefinitely.
  fastify.get<{ Params: { id: string; key: string } }>(
    "/ota/assets/:id/:key",
    { schema: { params: assetParams }, config: { rateLimit: publicTokenRateLimit } },
    async (request, reply) => {
      const asset = await service.findAsset(request.params.id, request.params.key);
      const stream = await openStoredFile(asset.storagePath);
      return reply
        .type(asset.contentType)
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(stream);
    },
  );

  fastify.post("/ota/publish", async (request, reply) => {
    assertPublisher(request);

    let input: PublishManifestInput | null = null;
    const files = new Map<string, Buffer>();

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "manifest") {
        input = JSON.parse(String(part.value)) as PublishManifestInput;
      } else if (part.type === "file") {
        files.set(part.fieldname, await part.toBuffer());
      }
    }

    if (!input) throw new BadRequestError("Missing manifest field");
    if (!isPlatform(input.platform)) throw new BadRequestError("Unsupported platform");
    if (!input.runtimeVersion) throw new BadRequestError("Missing runtimeVersion");

    const result = await service.publish(input, files);
    request.log.info({ ...result, commitSha: input.commitSha }, "published OTA update");
    return reply.status(201).send(result);
  });
};

export default otaRoutes;
