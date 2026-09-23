import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../../config/index.ts";
import { preconRepository } from "./repository.ts";
import { preconService, type PublishFn } from "./service.ts";
import applyToEstimateRoutes from "./apply-to-estimate-routes.ts";
import { reviewRoutes } from "./review-routes.ts";
import { manualRoutes } from "./manual-routes.ts";
import { sheetGeometryRoutes } from "./sheet-geometry-routes.ts";
import { assemblyMeasurementRoutes } from "./assembly-routes.ts";
import { presenceRoutes } from "./presence-routes.ts";
import { sessionRoutes } from "./session-routes.ts";
import { rowRoutes } from "./row-routes.ts";
import { editorOperationRoutes } from "./editor-operation-routes.ts";
import { editorBatchRoutes } from "./editor-batch-routes.ts";
import { workbookRoutes } from "./workbook/routes.ts";
import { geometryRoutes } from "./geometry-routes.ts";
import { sheetRoutes } from "./sheet-routes.ts";
import { programmeRoutes } from "./programme-routes.ts";
import { staleLookupFromPlans } from "./stale.ts";
import { plansRepository } from "../../proposals/plans-repository.ts";
import { validatorFor } from "../../../plugins/request-validation.ts";

// Preconstruction lives in the sales suite: every route is organization-scoped
// (bids usually precede a project). Reads need org membership; writes need the
// proposals org permission, mirroring the proposals module.
//
// This file is the registration facade: it builds the repository and service
// once, then hands them to each domain-scoped sub-router.
const pdfTakeoffRoutes: FastifyPluginAsync = async (fastify) => {
  // Coordinates arrive already typed, so no body under this plugin may have a
  // `null` coerced into a 0 nobody drew. Encapsulated on purpose: it binds THIS
  // subtree and leaves every sibling route on the factory's compiler.
  fastify.setValidatorCompiler(validatorFor);

  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 10 },
  });

  const repo = preconRepository(fastify.db);
  const publish: PublishFn = (sessionId, event) => {
    fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
  };
  const service = preconService(repo, publish, staleLookupFromPlans(plansRepository(fastify.db)));

  await fastify.register(sessionRoutes, { service });

  await fastify.register(reviewRoutes, { service });
  await fastify.register(manualRoutes, { service, publish });
  await fastify.register(sheetGeometryRoutes, { service });
  await fastify.register(assemblyMeasurementRoutes, { service, repo, publish });
  await fastify.register(presenceRoutes, { service });

  await fastify.register(rowRoutes, { service, publish });
  await fastify.register(editorOperationRoutes, { service, publish });
  await fastify.register(editorBatchRoutes, { service, publish });
  await fastify.register(workbookRoutes, { service, publish });
  await fastify.register(programmeRoutes, { service });
  await fastify.register(geometryRoutes, { service, publish });
  await fastify.register(sheetRoutes, { service, repo });

  await fastify.register(applyToEstimateRoutes);
};

export default pdfTakeoffRoutes;
