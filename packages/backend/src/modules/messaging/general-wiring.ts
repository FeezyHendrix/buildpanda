import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { channelService } from "./channel-service.ts";
import { projectGeneralRepository } from "./general-repository.ts";
import { messagingRepository } from "./repository.ts";

/** Serialize lazy General creation; a caller transaction also owns membership and the first message. */
export async function ensureProjectGeneral(db: Knex, projectId: string, actorId: string) {
  return db.transaction(async (transaction) => {
    const projects = projectGeneralRepository(transaction), repository = messagingRepository(transaction);
    const project = await projects.lockProject(projectId);
    if (!project) throw new NotFoundError("Project");
    const existing = await repository.findProjectChannelByName(projectId, "general");
    if (existing?.is_private && !(await repository.isMember(existing.id, actorId))) throw new NotFoundError("Channel");
    const members = await projects.memberIds(projectId);
    if (project.owner_id) members.push(project.owner_id);
    return channelService(repository).ensureProjectGeneral(project.id, members, actorId);
  });
}
