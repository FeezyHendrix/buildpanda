import type { Knex } from "knex";

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
  production: {
    client: "pg",
    connection: process.env["DATABASE_URL"],
    pool: { min: 2, max: 10 },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
    },
  },
};

export default config;
