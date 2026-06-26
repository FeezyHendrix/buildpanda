function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Secret that may be empty in dev/test but MUST be set in production: an empty
// auth signing secret forges sessions trivially, so we fail fast at boot.
function requiredInProduction(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (env === "production") {
    throw new Error(`Missing required env var in production: ${name}`);
  }
  return devFallback;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  }
  return parsed;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

const env = optional("NODE_ENV", "development");

export const config = {
  env,
  isProduction: env === "production",
  isTest: env === "test",

  http: {
    host: optional("HOST", "0.0.0.0"),
    port: optionalNumber("PORT", 3000),
    // Comma-separated list. Defaults include the app (5173), admin (5174) and
    // marketing site (3001, posts consultation leads). In production this must
    // include https://buildpanda.io (and www) for the lead form to work.
    corsOrigins: optional(
      "CORS_ORIGIN",
      "http://localhost:5173,http://localhost:5174,http://localhost:3001",
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    logLevel: optional("LOG_LEVEL", "info"),
  },

  cluster: {
    workers: optionalNumber("CLUSTER_WORKERS", optionalNumber("WEB_CONCURRENCY", 1)),
  },

  worker: {
    runWorkers: optionalBool("RUN_WORKERS", true),
  },

  dbPoolMax: optionalNumber("DB_POOL_MAX", 10),

  // Emails auto-promoted to the global `admin` role on login (bootstraps the
  // first platform admin without manual DB edits). Comma-separated.
  adminEmails: optional("ADMIN_EMAILS", "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),

  db:
    env === "production"
      ? { connectionString: required("DATABASE_URL") }
      : {
          host: optional("DB_HOST", "localhost"),
          port: optionalNumber("DB_PORT", 5432),
          database: optional("DB_NAME", "buildpanda"),
          user: optional("DB_USER", "postgres"),
          password: optional("DB_PASSWORD", "postgres"),
        },

  auth: {
    secret: requiredInProduction("BETTER_AUTH_SECRET", "dev-insecure-secret-change-me"),
    baseUrl: optional("BETTER_AUTH_URL", "http://localhost:3000"),
  },

  consulting: {
    orgId: optional("BUILDPANDA_CONSULTING_ORG_ID", ""),
  },

  finance: {
    vatPct: optionalNumber("FINANCE_DEFAULT_VAT_PCT", 7.5),
    whtPct: optionalNumber("FINANCE_DEFAULT_WHT_PCT", 0),
    retentionPct: optionalNumber("FINANCE_DEFAULT_RETENTION_PCT", 0),
  },

  mail: {
    token: optional("ZEPTOMAIL_TOKEN", ""),
    fromAddress: optional("ZEPTOMAIL_FROM_ADDRESS", "noreply@buildpanda.io"),
    fromName: optional("ZEPTOMAIL_FROM_NAME", "BuildPanda"),
    replyToAddress: optional("ZEPTOMAIL_REPLY_TO", "hello@buildpanda.io"),
    appUrl: optional("CORS_ORIGIN", "http://localhost:5173")
      .split(",")[0]!
      .trim(),
    logoUrl: optional("EMAIL_LOGO_URL", "https://buildpanda.io/logo.png"),
    walkthroughVideoUrl: optional("WALKTHROUGH_VIDEO_URL", "https://buildpanda.io"),
    // Inboxes that receive "Book a consultation" leads from the marketing
    // site. Comma-separated.
    leadsNotifyAddresses: optional(
      "LEADS_NOTIFY_EMAIL",
      "buildpanda.io@gmail.com,michaelade.build@gmail.com",
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },

  uploads: {
    maxFileBytes: optionalNumber("UPLOAD_MAX_BYTES", 25 * 1024 * 1024),
  },

  // Background jobs. When url is empty the queue runs in inline mode (see
  // QueueManager) so the app still functions without a Redis server.
  redis: {
    url: optional("REDIS_URL", ""),
  },

  rateLimit: {
    enabled: optionalBool("RATE_LIMIT_ENABLED", true),
    global: {
      max: optionalNumber("RATE_LIMIT_GLOBAL_MAX", 300),
      timeWindow: optionalNumber("RATE_LIMIT_GLOBAL_WINDOW_MS", 60_000),
    },
  },

  // Panda AI insights. When apiKey is empty the engine falls back to a
  // deterministic local analyzer instead of calling Moonshot/KIMI.
  ai: {
    apiKey: optional("KIMI_API_KEY", ""),
    baseUrl: optional("KIMI_BASE_URL", "https://api.moonshot.ai/v1"),
    model: optional("KIMI_MODEL", "kimi-k2-0905-preview"),
    timeoutMs: optionalNumber("KIMI_TIMEOUT_MS", 45_000),
  },

  openai: {
    apiKey: optional("OPENAI_API_KEY", ""),
    baseUrl: optional("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    model: optional("OPENAI_MODEL", "gpt-4o-mini"),
    timeoutMs: optionalNumber("OPENAI_TIMEOUT_MS", 60_000),
  },

  storage: {
    bucket: optional("S3_BUCKET", "buildpanda"),
    region: optional("AWS_REGION", "us-east-1"),
    endpoint: optional("S3_ENDPOINT", ""),
    accessKeyId: optional("AWS_ACCESS_KEY_ID", ""),
    secretAccessKey: optional("AWS_SECRET_ACCESS_KEY", ""),
    forcePathStyle: optional("S3_FORCE_PATH_STYLE", "auto"),
    ensureBucketOnStartup: optional("S3_ENSURE_BUCKET", env === "production" ? "false" : "true") === "true",
    // SSE-S3 (AES256) on server-initiated writes. Real S3 supports it natively;
    // a plain MinIO (custom endpoint, no KES/KMS) returns NotImplemented, so it
    // defaults off whenever a custom endpoint is configured.
    serverSideEncryption: optionalBool("S3_SERVER_SIDE_ENCRYPTION", optional("S3_ENDPOINT", "") === ""),
  },

  // Sentry error monitoring. Only runs in production (i.e. on Railway, which
  // sets NODE_ENV=production) AND when a DSN is configured — never in local or
  // dev, even if a DSN leaks into the environment. tracesSampleRate defaults
  // low in production.
  sentry: {
    dsn: optional("SENTRY_DSN", ""),
    enabled: env === "production" && Boolean(optional("SENTRY_DSN", "")),
    environment: optional("SENTRY_ENVIRONMENT", env),
    release: optional("SENTRY_RELEASE", ""),
    tracesSampleRate: optionalNumber("SENTRY_TRACES_SAMPLE_RATE", env === "production" ? 0.1 : 1.0),
  },
} as const;

export type Config = typeof config;
