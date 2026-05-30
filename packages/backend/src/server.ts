import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/index.ts";
import databasePlugin from "./plugins/database.ts";
import authContextPlugin from "./plugins/auth-context.ts";
import errorHandlerPlugin from "./plugins/error-handler.ts";
import authRoutes from "./modules/auth/routes.ts";
import healthRoutes from "./modules/health/routes.ts";
import userRoutes from "./modules/users/routes.ts";
import projectRoutes from "./modules/projects/routes.ts";
import updateRoutes from "./modules/updates/routes.ts";
import documentRoutes from "./modules/documents/routes.ts";
import inspectionRoutes from "./modules/inspections/routes.ts";
import financeRoutes from "./modules/finances/routes.ts";
import riskRoutes from "./modules/risks/routes.ts";
import notificationRoutes from "./modules/notifications/routes.ts";
import searchRoutes from "./modules/search/routes.ts";
import fileRoutes from "./modules/files/routes.ts";
import activityRoutes from "./modules/activities/routes.ts";
import dailyLogRoutes from "./modules/daily-logs/routes.ts";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.http.logLevel },
    disableRequestLogging: false,
  });

  await app.register(cors, {
    origin: config.http.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(databasePlugin);
  await app.register(errorHandlerPlugin);
  await app.register(authContextPlugin);

  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(updateRoutes);
  await app.register(documentRoutes);
  await app.register(inspectionRoutes);
  await app.register(financeRoutes);
  await app.register(riskRoutes);
  await app.register(notificationRoutes);
  await app.register(searchRoutes);
  await app.register(fileRoutes);
  await app.register(activityRoutes);
  await app.register(dailyLogRoutes);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    app.log.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    app.log.fatal({ err: reason }, "Unhandled rejection");
    process.exit(1);
  });

  try {
    await app.listen({ host: config.http.host, port: config.http.port });
  } catch (error) {
    app.log.fatal({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  void start();
}
