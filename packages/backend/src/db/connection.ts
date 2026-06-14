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
        pool: { min: 2, max: config.dbPoolMax },
      }
    : {
        client: "pg",
        connection: config.db,
        pool: { min: 2, max: config.dbPoolMax },
      };

export const db: Knex = knex(connectionConfig);
export default db;
