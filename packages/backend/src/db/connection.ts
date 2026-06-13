import knex from "knex";
import type { Knex } from "knex";
import { types as pgTypes } from "pg";
import { config } from "../config/index.ts";

const PG_DATE_OID = 1082;
pgTypes.setTypeParser(PG_DATE_OID, (value: string) => value);

const connectionConfig: Knex.Config =
  "connectionString" in config.db
    ? {
        client: "pg",
        connection: config.db.connectionString,
        pool: { min: 2, max: 10 },
      }
    : {
        client: "pg",
        connection: config.db,
      };

export const db: Knex = knex(connectionConfig);
export default db;
