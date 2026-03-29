import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import databasePlugin from "./plugins/database.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/users.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  await app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? true,
  });

  await app.register(databasePlugin);
  await app.register(healthRoutes);
  await app.register(userRoutes);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: "Validation Error",
        details: error.validation,
      });
    }

    return reply.status(error.statusCode ?? 500).send({
      error: error.message ?? "Internal Server Error",
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
