import type { Channel } from "@/api/messaging";
import { DENY } from "./access-requirement";
import { features } from "./feature-access";
import { projectAccess } from "./project-access-store";

/** A channel keeps its own project/workspace boundary, even from a deep link. */
export function channelRequirement(channel: Channel | undefined, write = false) {
  const scope = projectAccess.getState().scope;
  if (!scope || !channel) return DENY;
  if (channel.type === "project") {
    if (channel.projectId !== scope.projectId) return DENY;
    return write ? features.messages.actions.create : features.messages.read;
  }
  if (channel.organizationId && channel.organizationId !== scope.organizationId) return DENY;
  return write ? features.workspaceMessages.actions.create : features.workspaceMessages.read;
}
