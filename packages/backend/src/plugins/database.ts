import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import db from "../db/connection.js";
import type { Knex } from "knex";

declare module "fastify" {
  interface FastifyInstance {
    db: Knex;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await db.destroy();
  });
};

export default fp(databasePlugin, { name: "database" });
