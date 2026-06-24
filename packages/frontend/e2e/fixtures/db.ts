import knexFactory, { type Knex } from "knex";
import { env } from "../config/env";

// Connects to the SAME Postgres the backend uses. Prefers DATABASE_URL; falls
// back to the discrete DB_* vars with the knexfile's dev defaults so a local
// `pnpm dev` database is reachable with zero extra config.
// ASSUMPTION (A4): used only to flip `emailVerified` after sign-up (Better Auth
// gates sign-in on it) and for transactional teardown — never to seed business
// data (that goes through the API).
let cached: Knex | null = null;

export function db(): Knex {
  if (cached) return cached;
  const connection = env.databaseUrl
    ? env.databaseUrl
    : {
        host: process.env["DB_HOST"] ?? "localhost",
        port: Number(process.env["DB_PORT"] ?? 5432),
        database: process.env["DB_NAME"] ?? "buildpanda",
        user: process.env["DB_USER"] ?? "postgres",
        password: process.env["DB_PASSWORD"] ?? "postgres",
      };
  cached = knexFactory({ client: "pg", connection, pool: { min: 0, max: 4 } });
  return cached;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.destroy();
    cached = null;
  }
}
