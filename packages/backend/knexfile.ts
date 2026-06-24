import type { Knex } from "knex";

// Any deployed environment (production, staging, …) connects via DATABASE_URL.
// knex CLI selects the config by NODE_ENV, so every deploy env needs an entry —
// a missing key resolves to undefined and fails with "client is missing".
const hosted: Knex.Config = {
  client: "pg",
  connection: process.env["DATABASE_URL"],
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "./src/db/migrations",
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    client: "pg",
    connection: {
      host: process.env["DB_HOST"] ?? "localhost",
      port: Number(process.env["DB_PORT"] ?? 5432),
      database: process.env["DB_NAME"] ?? "buildpanda",
      user: process.env["DB_USER"] ?? "postgres",
      password: process.env["DB_PASSWORD"] ?? "postgres",
    },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./src/db/seeds",
      extension: "ts",
    },
  },
  production: hosted,
  staging: hosted,
};

export default config;
