import "./instrument.ts";
import * as Sentry from "@sentry/node";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/index.ts";
import { isSupportedCurrency } from "./lib/currencies.ts";
import { setLogger } from "./lib/logger.ts";
import { setLlmCallSink } from "./lib/llm.ts";
import { llmCallsRepository } from "./modules/llm-calls/repository.ts";
import databasePlugin from "./plugins/database.ts";
import accessCachePlugin from "./plugins/access-cache.ts";
import authContextPlugin from "./plugins/auth-context.ts";
import errorHandlerPlugin from "./plugins/error-handler.ts";
import securityPlugin from "./plugins/security.ts";
import featureFlagsPlugin from "./plugins/feature-flags.ts";
import queuePlugin from "./plugins/queue.ts";
import realtimePlugin from "./plugins/realtime.ts";
import authRoutes from "./modules/auth/routes.ts";
import assetRoutes from "./modules/assets/routes.ts";
import healthRoutes from "./modules/health/routes.ts";
import permissionsRoutes from "./modules/permissions/routes.ts";
import leadRoutes from "./modules/leads/routes.ts";
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
import teamMemberRoutes from "./modules/team-members/routes.ts";
import invoiceRoutes from "./modules/invoices/routes.ts";
import publicInvoiceRoutes from "./modules/invoices/public-routes.ts";
import paymentClaimRoutes from "./modules/payment-claims/routes.ts";
import purchaseOrderRoutes from "./modules/purchase-orders/routes.ts";
import budgetRoutes from "./modules/budget/routes.ts";
import adminRoutes from "./modules/admin/routes.ts";
import stageRoutes from "./modules/stages/routes.ts";
import buildingRoutes from "./modules/buildings/routes.ts";
import actionItemRoutes from "./modules/action-items/routes.ts";
import queryRoutes from "./modules/queries/routes.ts";
import rfiRoutes from "./modules/rfis/routes.ts";
import publicRfiRoutes from "./modules/rfis/public-routes.ts";
import bimRoutes from "./modules/bim/routes.ts";
import approvalRoutes from "./modules/approvals/routes.ts";
import selectionRoutes from "./modules/selections/routes.ts";
import changeRequestRoutes from "./modules/change-requests/routes.ts";
import permitRoutes from "./modules/permits/index.ts";
import keyDateRoutes from "./modules/key-dates/index.ts";
import insightsRoutes from "./modules/insights/index.ts";
import reportingRoutes from "./modules/reporting/routes.ts";
import weatherRoutes from "./modules/weather/routes.ts";
import maintenanceRoutes from "./modules/maintenance/routes.ts";
import featureFlagRoutes from "./modules/feature-flags/routes.ts";
import participantRoutes from "./modules/participants/index.ts";
import messagingRoutes from "./modules/messaging/routes.ts";
import linkPreviewRoutes from "./modules/link-preview/routes.ts";
import materialsEquipmentRoutes from "./modules/materials-equipment/routes.ts";
import pandaAiRoutes from "./modules/panda-ai/routes.ts";
import pandaAiAgentRoutes from "./modules/panda-ai/agent/routes.ts";
import programmeImportRoutes from "./modules/panda-ai/programme/routes.ts";
import dwgTakeoffRoutes from "./modules/panda-ai/dwg-takeoff/routes.ts";
import pdfTakeoffRoutes from "./modules/panda-ai/pdf-takeoff/routes.ts";
import importSessionRoutes from "./modules/import-sessions/routes.ts";
import orgProfileRoutes from "./modules/org-profile/routes.ts";
import dataCommitmentRoutes from "./modules/data-commitment/routes.ts";
import proposalRoutes from "./modules/proposals/routes.ts";
import publicProposalRoutes from "./modules/proposals/public-routes.ts";
import fileSharesRoutes from "./modules/file-shares/routes.ts";
import publicFileShareRoutes from "./modules/file-shares/public-routes.ts";
import taskRoutes from "./modules/tasks/routes.ts";
import materialsLedgerRoutes from "./modules/materials-ledger/routes.ts";
import suppliersRoutes from "./modules/suppliers/routes.ts";
import lookAheadRoutes from "./modules/look-aheads/routes.ts";
import transactionRoutes from "./modules/transactions/routes.ts";
import { besmmRag } from "./lib/besmm-rag.ts";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.http.logLevel,
      // Strip credentials and client PII from logs at the serializer level so
      // session tokens / passwords / personal data never reach log storage,
      // regardless of what a handler passes to request.log.
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "password",
          "token",
          "*.password",
          "*.token",
          "*.authorization",
          "*.cookie",
        ],
        censor: "[redacted]",
      },
    },
    disableRequestLogging: false,
    // Railway/edge terminates TLS and forwards the client IP via X-Forwarded-For;
    // trustProxy makes request.ip reflect the real client so rate limiting and
    // geo key off the caller, not the proxy.
    trustProxy: true,
    ajv: {
      plugins: [
        (ajv) => {
          ajv.addFormat("currency", { type: "string", validate: isSupportedCurrency });
          return ajv;
        },
      ],
    },
  });

  setLogger(app.log);

  if (config.sentry.enabled) {
    Sentry.setupFastifyErrorHandler(app);
  }

  await app.register(cors, {
    origin: config.http.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(securityPlugin);

  await app.register(databasePlugin);

  // Persist every validated LLM call for audit + offline evaluation. Fire-and-
  // forget: a logging failure must never break the live request.
  const llmCalls = llmCallsRepository(app.db);
  setLlmCallSink((rec) => {
    void llmCalls.insert(rec).catch((err) => app.log.warn({ err }, "llm_calls insert failed"));
  });

  await app.register(errorHandlerPlugin);
  await app.register(accessCachePlugin);
  await app.register(authContextPlugin);
  await app.register(featureFlagsPlugin);
  await app.register(queuePlugin);
  await app.register(realtimePlugin);

  await app.register(authRoutes);
  await app.register(assetRoutes);
  await app.register(healthRoutes);
  await app.register(permissionsRoutes);
  await app.register(leadRoutes);
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
  await app.register(teamMemberRoutes);
  await app.register(invoiceRoutes);
  await app.register(publicInvoiceRoutes);
  await app.register(paymentClaimRoutes);
  await app.register(purchaseOrderRoutes);
  await app.register(budgetRoutes);
  await app.register(adminRoutes);
  await app.register(stageRoutes);
  await app.register(buildingRoutes);
  await app.register(actionItemRoutes);
  await app.register(queryRoutes);
  await app.register(rfiRoutes);
  await app.register(publicRfiRoutes);
  await app.register(bimRoutes);
  await app.register(approvalRoutes);
  await app.register(selectionRoutes);
  await app.register(changeRequestRoutes);
  await app.register(permitRoutes);
  await app.register(keyDateRoutes);
  await app.register(insightsRoutes);
  await app.register(reportingRoutes);
  await app.register(weatherRoutes);
  await app.register(maintenanceRoutes);
  await app.register(featureFlagRoutes);
  await app.register(participantRoutes);
  await app.register(messagingRoutes);
  await app.register(linkPreviewRoutes);
  await app.register(materialsEquipmentRoutes);
  await app.register(pandaAiRoutes);
  await app.register(pandaAiAgentRoutes);
  await app.register(programmeImportRoutes);
  await app.register(dwgTakeoffRoutes);
  await app.register(pdfTakeoffRoutes);
  await app.register(importSessionRoutes);
  await app.register(orgProfileRoutes);
  await app.register(dataCommitmentRoutes);
  await app.register(proposalRoutes);
  await app.register(publicProposalRoutes);
  await app.register(fileSharesRoutes);
  await app.register(publicFileShareRoutes);
  await app.register(taskRoutes);
  await app.register(materialsLedgerRoutes);
  await app.register(suppliersRoutes);
  await app.register(lookAheadRoutes);
  await app.register(transactionRoutes);

  return app;
}

export async function start(): Promise<void> {
  const app = await buildApp();

  try {
    const { seeded } = await besmmRag(app.db).ensureSeeded();
    if (seeded > 0) app.log.info({ seeded }, "Seeded BESMM vector store from committed embeddings");
  } catch (error) {
    app.log.warn({ err: error }, "BESMM vector store seed skipped; take-off will use static reference");
  }

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
    Sentry.captureException(error, { level: "fatal", tags: { lifecycle: "uncaughtException" } });
    void Sentry.flush(2000).finally(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    app.log.fatal({ err: reason }, "Unhandled rejection");
    Sentry.captureException(reason, { level: "fatal", tags: { lifecycle: "unhandledRejection" } });
    void Sentry.flush(2000).finally(() => process.exit(1));
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
