import type { AgentSession } from "../api/agent";
import type { ToolCatalog } from "../api/tool-types";

export function allowsProjectScope(session: AgentSession, catalog?: ToolCatalog): boolean {
  return session.capabilities?.read === true || session.capabilities?.materialReceipt === true || session.capabilities?.materialUsage === true
    || catalog?.tools.some((tool) => !tool.requiresBuilding && session.capabilities?.actions?.[tool.kind] === true) === true;
}

export function hasCaptureScope(session: AgentSession, catalog?: ToolCatalog): boolean {
  return Boolean(session.buildingId) || allowsProjectScope(session, catalog);
}
