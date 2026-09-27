import type { FastifyPluginAsync } from "fastify";
import {
  grantableCatalog,
  isPrivilegedGrant,
  rolePresetSides,
  rolePresets,
} from "../../lib/authorization.ts";

const permissionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/permissions/catalog", async (request) => {
    request.requireAuth();
    const catalog = grantableCatalog();
    const privileged: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(catalog)) {
      const priv = actions.filter((action) => isPrivilegedGrant(resource, action));
      if (priv.length > 0) privileged[resource] = priv;
    }
    return { resources: catalog, privileged, presets: rolePresets(), presetSides: rolePresetSides() };
  });
};

export default permissionsRoutes;
