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
    corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),
    logLevel: optional("LOG_LEVEL", "info"),
  },

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
    fromAddress: optional("ZEPTOMAIL_FROM_ADDRESS", "noreply@buildpanda.com"),
    fromName: optional("ZEPTOMAIL_FROM_NAME", "BuildPanda"),
  },

  uploads: {
    maxFileBytes: optionalNumber("UPLOAD_MAX_BYTES", 25 * 1024 * 1024),
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
