import knex from "knex";
import type { Knex } from "knex";
import { types as pgTypes } from "pg";

const PG_DATE_OID = 1082;
pgTypes.setTypeParser(PG_DATE_OID, (value: string) => value);

const env = process.env["NODE_ENV"] ?? "development";

const connectionConfig: Knex.Config =
  env === "production"
    ? {
        client: "pg",
        connection: process.env["DATABASE_URL"],
        pool: { min: 2, max: 10 },
      }
    : {
        client: "pg",
        connection: {
          host: process.env["DB_HOST"] ?? "localhost",
          port: Number(process.env["DB_PORT"] ?? 5432),
          database: process.env["DB_NAME"] ?? "buildpanda",
          user: process.env["DB_USER"] ?? "postgres",
          password: process.env["DB_PASSWORD"] ?? "postgres",
        },
      };

export const db: Knex = knex(connectionConfig);
export default db;
