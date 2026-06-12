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

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  }
  return parsed;
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
    secret: optional("BETTER_AUTH_SECRET", ""),
    baseUrl: optional("BETTER_AUTH_URL", "http://localhost:3000"),
  },

  mail: {
    token: optional("ZEPTOMAIL_TOKEN", ""),
    fromAddress: optional("ZEPTOMAIL_FROM_ADDRESS", "noreply@buildpanda.io"),
    fromName: optional("ZEPTOMAIL_FROM_NAME", "BuildPanda"),
    // Link target for the logo in email headers (the app sign-in origin).
    appUrl: optional("CORS_ORIGIN", "http://localhost:5173")
      .split(",")[0]!
      .trim(),
    // Where the email header logo is hosted. Defaults to the API's own
    // /static/email-logo.png route so it works wherever the backend deploys.
    logoUrl: optional(
      "EMAIL_LOGO_URL",
      `${optional("BETTER_AUTH_URL", "http://localhost:3000")}/static/email-logo.png`,
    ),
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

  // Panda AI insights. When apiKey is empty the engine falls back to a
  // deterministic local analyzer instead of calling Moonshot/KIMI.
  ai: {
    apiKey: optional("KIMI_API_KEY", ""),
    baseUrl: optional("KIMI_BASE_URL", "https://api.moonshot.ai/v1"),
    model: optional("KIMI_MODEL", "kimi-k2-0905-preview"),
    timeoutMs: optionalNumber("KIMI_TIMEOUT_MS", 45_000),
  },

  storage: {
    bucket: optional("S3_BUCKET", "buildpanda"),
    region: optional("AWS_REGION", "us-east-1"),
    endpoint: optional("S3_ENDPOINT", ""),
    accessKeyId: optional("AWS_ACCESS_KEY_ID", ""),
    secretAccessKey: optional("AWS_SECRET_ACCESS_KEY", ""),
    forcePathStyle: optional("S3_FORCE_PATH_STYLE", "auto"),
    ensureBucketOnStartup: optional("S3_ENSURE_BUCKET", env === "production" ? "false" : "true") === "true",
  },
} as const;

export type Config = typeof config;
