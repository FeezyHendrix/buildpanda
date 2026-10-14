import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { MessagingRepository } from "./repository.ts";
import type { Channel, CreateChannelInput } from "./types.ts";
import { toChannel } from "./mappers.ts";
import { messagingSupport } from "./service-support.ts";

export function channelService(repository: MessagingRepository) {
  const { requireMembership } = messagingSupport(repository, {});
  return {
    async listChannels(userId: string): Promise<Channel[]> {
      const rows = await repository.listForUser(userId);
      return rows.map(toChannel);
    },

    async listProjectChannels(projectId: string, userId: string): Promise<Channel[]> {
      const rows = await repository.listForProject(projectId, userId);
      return rows.map(toChannel);
    },

    async getChannel(channelId: string, userId: string): Promise<Channel> {
      const row = await repository.findChannelForUser(channelId, userId);
      if (!row) throw new NotFoundError("Channel");
      return toChannel(row);
    },

    async updateChannel(
      channelId: string,
      patch: { name?: string; topic?: string | null; archived?: boolean },
      userId: string,
    ): Promise<Channel> {
      const membership = await requireMembership(channelId, userId);
      if (membership.role !== "admin") throw new ForbiddenError("Only channel admins can update the channel");
      const dbPatch: { name?: string; topic?: string | null; archived_at?: string | null } = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.topic !== undefined) dbPatch.topic = patch.topic;
      if (patch.archived !== undefined) dbPatch.archived_at = patch.archived ? new Date().toISOString() : null;
      await repository.updateChannel(channelId, dbPatch);
      const row = await repository.findChannelForUser(channelId, userId);
      return toChannel(row!);
    },

    async removeFromProjectChannels(projectId: string, userId: string): Promise<void> {
      await repository.removeMembersForProject(projectId, userId);
    },

    async ensureProjectGeneral(
      projectId: string,
      memberIds: string[],
      actorId: string,
    ): Promise<Channel> {
      const existing = await repository.findProjectChannelByName(projectId, "general");
      if (existing) {
        const withMembership = await repository.findChannelForUser(existing.id, actorId);
        if (withMembership) return toChannel(withMembership);
        await repository.addMember({
          id: generateId("cm"),
          channel_id: existing.id,
          user_id: actorId,
          role: "member",
          added_by_id: actorId,
        });
        const refetched = await repository.findChannelForUser(existing.id, actorId);
        return toChannel(refetched!);
      }
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: "project",
        name: "general",
        topic: null,
        project_id: projectId,
        organization_id: null,
        is_private: false,
        created_by_id: actorId,
      });
      const uniqueMembers = new Set([actorId, ...memberIds]);
      for (const userId of uniqueMembers) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: userId === actorId ? "admin" : "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

    async createChannel(input: CreateChannelInput, actorId: string): Promise<Channel> {
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: input.type,
        name: input.name.trim(),
        topic: input.topic ?? null,
        project_id: input.type === "project" ? (input.projectId ?? null) : null,
        organization_id: input.type === "org" ? (input.organizationId ?? null) : null,
        is_private: input.isPrivate ?? false,
        created_by_id: actorId,
      });
      const members = new Set([actorId, ...(input.memberIds ?? [])]);
      for (const userId of members) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: userId === actorId ? "admin" : "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

    async openOrCreateDm(otherUserId: string, actorId: string): Promise<Channel> {
      if (otherUserId === actorId) throw new ForbiddenError("Cannot DM yourself");
      const existing = await repository.findDmChannel([actorId, otherUserId]);
      if (existing) {
        const withMembership = await repository.findChannelForUser(existing.id, actorId);
        return toChannel(withMembership!);
      }
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: "dm",
        name: null,
        topic: null,
        project_id: null,
        organization_id: null,
        is_private: true,
        created_by_id: actorId,
      });
      for (const userId of [actorId, otherUserId]) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

  };
}
