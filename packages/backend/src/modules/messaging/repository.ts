import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type {
  ChannelRow,
  ChannelMemberRow,
  MemberRole,
  MessageRow,
  NotifyLevel,
} from "./types.ts";

export interface NewChannelRecord {
  id: string;
  type: string;
  name: string | null;
  topic: string | null;
  project_id: string | null;
  organization_id: string | null;
  is_private: boolean;
  created_by_id: string | null;
}

export interface NewMemberRecord {
  id: string;
  channel_id: string;
  user_id: string;
  role: MemberRole;
  added_by_id: string | null;
}

export interface NewMessageRecord {
  id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  content_html: string | null;
  parent_message_id: string | null;
  quoted_message_id: string | null;
  references: string;
  mentions: string;
  attachments: string;
}

export interface QuotedPreviewRow {
  id: string;
  author_name: string | null;
  body: string;
  deleted_at: Date | string | null;
}

export interface MessageUpdatePatch {
  body?: string;
  content_html?: string | null;
  edited_at?: string;
  deleted_at?: string;
}

const CHANNEL_SELECT = [
  "c.id",
  "c.type",
  "c.name",
  "c.topic",
  "c.project_id",
  "c.organization_id",
  "c.is_private",
  "c.archived_at",
  "c.created_by_id",
  "c.created_at",
  "c.updated_at",
  "cm.muted as muted",
  "cm.notify_level as notify_level",
];

export function messagingRepository(db: Knex) {
  function memberChannelBase(userId: string) {
    return db<ChannelRow>("channels as c")
      .join("channel_members as cm", function () {
        this.on("cm.channel_id", "c.id").andOnVal("cm.user_id", userId);
      });
  }

  function unreadCountExpr(userId: string) {
    return db("messages as m")
      .whereRaw("m.channel_id = c.id")
      .whereNull("m.deleted_at")
      .where("m.author_id", "!=", userId)
      .whereRaw(
        "m.created_at > COALESCE((SELECT last_read_at FROM channel_members WHERE channel_id = c.id AND user_id = ?), '1970-01-01')",
        [userId],
      )
      .count();
  }

  return {
    listForUser(userId: string): Promise<ChannelRow[]> {
      return memberChannelBase(userId)
        .whereNull("c.archived_at")
        .select(CHANNEL_SELECT)
        .select<ChannelRow[]>(db.raw("(?) as unread_count", [unreadCountExpr(userId)]))
        .orderBy("c.updated_at", "desc");
    },

    listForProject(projectId: string, userId: string): Promise<ChannelRow[]> {
      return memberChannelBase(userId)
        .where("c.project_id", projectId)
        .whereNull("c.archived_at")
        .select(CHANNEL_SELECT)
        .select<ChannelRow[]>(db.raw("(?) as unread_count", [unreadCountExpr(userId)]))
        .orderBy("c.created_at", "asc");
    },

    findChannelForUser(channelId: string, userId: string): Promise<ChannelRow | undefined> {
      return memberChannelBase(userId)
        .where("c.id", channelId)
        .select(CHANNEL_SELECT)
        .select<ChannelRow[]>(db.raw("(?) as unread_count", [unreadCountExpr(userId)]))
        .first();
    },

    findChannelById(channelId: string): Promise<ChannelRow | undefined> {
      return db<ChannelRow>("channels as c").where("c.id", channelId).first();
    },

    findProjectChannelByName(projectId: string, name: string): Promise<ChannelRow | undefined> {
      return db<ChannelRow>("channels")
        .where({ project_id: projectId, name })
        .first();
    },

    async createChannel(record: NewChannelRecord): Promise<ChannelRow> {
      const [row] = await db("channels").insert(record).returning<ChannelRow[]>("*");
      return row!;
    },

    isMember(channelId: string, userId: string): Promise<ChannelMemberRow | undefined> {
      return db<ChannelMemberRow>("channel_members")
        .where({ channel_id: channelId, user_id: userId })
        .first();
    },

    listMembers(channelId: string): Promise<(ChannelMemberRow & { name: string | null; email: string })[]> {
      return db<ChannelMemberRow>("channel_members as cm")
        .join("user as u", "u.id", "cm.user_id")
        .where("cm.channel_id", channelId)
        .select<(ChannelMemberRow & { name: string | null; email: string })[]>(
          "cm.*",
          "u.name as name",
          "u.email as email",
        );
    },

    async projectMentionUserIds(projectId: string): Promise<string[]> {
      const participantIds = await db("project_participants")
        .where({ project_id: projectId, status: "active" })
        .whereNotNull("user_id")
        .pluck<string[]>("user_id");
      const project = await db("projects")
        .where({ id: projectId })
        .first<{ owner_id: string | null }>("owner_id");
      return [...new Set([...(project?.owner_id ? [project.owner_id] : []), ...participantIds])];
    },

    async companyMentionUserIds(input: { projectId?: string | null; organizationId?: string | null }): Promise<string[]> {
      let organizationId = input.organizationId ?? null;
      let ownerId: string | null = null;
      if (!organizationId && input.projectId) {
        const project = await db("projects")
          .where({ id: input.projectId })
          .first<{ organization_id: string | null; owner_id: string | null }>("organization_id", "owner_id");
        organizationId = project?.organization_id ?? null;
        ownerId = project?.owner_id ?? null;
      }
      const orgMemberIds = organizationId
        ? await db("member").where({ organizationId }).pluck<string[]>("userId")
        : [];
      return [...new Set([...(ownerId ? [ownerId] : []), ...orgMemberIds])];
    },

    async addMember(record: NewMemberRecord): Promise<void> {
      await db("channel_members")
        .insert(record)
        .onConflict(["channel_id", "user_id"])
        .ignore();
    },

    async removeMember(channelId: string, userId: string): Promise<void> {
      await db("channel_members").where({ channel_id: channelId, user_id: userId }).del();
    },

    async updateMembership(
      channelId: string,
      userId: string,
      patch: { muted?: boolean; notify_level?: NotifyLevel; last_read_message_id?: string; last_read_at?: string },
    ): Promise<void> {
      await db("channel_members").where({ channel_id: channelId, user_id: userId }).update(patch);
    },

    listMessages(
      channelId: string,
      opts: { before?: string; limit: number },
    ): Promise<MessageRow[]> {
      let q = db<MessageRow>("messages as m")
        .leftJoin("user as u", "u.id", "m.author_id")
        .where("m.channel_id", channelId)
        .whereNull("m.parent_message_id")
        .select<MessageRow[]>("m.*", "u.name as author_name")
        .orderBy("m.created_at", "desc")
        .orderBy("m.id", "desc")
        .limit(opts.limit);
      if (opts.before) {
        q = q.where(
          "m.created_at",
          "<",
          db("messages").select("created_at").where("id", opts.before),
        );
      }
      return q;
    },

    findMessageById(id: string): Promise<MessageRow | undefined> {
      return db<MessageRow>("messages as m")
        .leftJoin("user as u", "u.id", "m.author_id")
        .where("m.id", id)
        .select<MessageRow[]>("m.*", "u.name as author_name")
        .first();
    },

    findQuotedPreviews(ids: string[]): Promise<QuotedPreviewRow[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return db("messages as m")
        .leftJoin("user as u", "u.id", "m.author_id")
        .whereIn("m.id", ids)
        .select<QuotedPreviewRow[]>("m.id", "u.name as author_name", "m.body", "m.deleted_at");
    },

    async createMessage(record: NewMessageRecord): Promise<MessageRow> {
      const [row] = await db("messages").insert(record).returning<MessageRow[]>("*");
      return row!;
    },

    async updateMessage(id: string, patch: MessageUpdatePatch): Promise<MessageRow | undefined> {
      const [row] = await db("messages").where({ id }).update(patch).returning<MessageRow[]>("*");
      return row;
    },

    async touchChannel(channelId: string): Promise<void> {
      await db("channels").where({ id: channelId }).update({ updated_at: new Date().toISOString() });
    },

    async recentlyActiveUserIds(channelId: string, sinceIso: string): Promise<string[]> {
      const rows = await db("messages")
        .where("channel_id", channelId)
        .where("created_at", ">=", sinceIso)
        .whereNotNull("author_id")
        .distinct<{ author_id: string }[]>("author_id");
      return rows.map((r) => r.author_id);
    },

    async updateChannel(
      channelId: string,
      patch: { name?: string; topic?: string | null; archived_at?: string | null },
    ): Promise<ChannelRow | undefined> {
      const [row] = await db("channels")
        .where({ id: channelId })
        .update({ ...patch, updated_at: new Date().toISOString() })
        .returning<ChannelRow[]>("*");
      return row;
    },

    removeMembersForProject(projectId: string, userId: string): Promise<number> {
      return db("channel_members")
        .whereIn(
          "channel_id",
          db("channels").select("id").where({ project_id: projectId }),
        )
        .where({ user_id: userId })
        .del();
    },

    async toggleReaction(messageId: string, userId: string, emoji: string): Promise<"added" | "removed"> {
      const existing = await db("message_reactions")
        .where({ message_id: messageId, user_id: userId, emoji })
        .first();
      if (existing) {
        await db("message_reactions").where({ id: existing.id }).del();
        return "removed";
      }
      await db("message_reactions").insert({
        id: generateId("rxn"),
        message_id: messageId,
        user_id: userId,
        emoji,
      });
      return "added";
    },

    reactionsForMessages(messageIds: string[]): Promise<{ message_id: string; emoji: string; user_id: string }[]> {
      if (messageIds.length === 0) return Promise.resolve([]);
      return db("message_reactions")
        .whereIn("message_id", messageIds)
        .select<{ message_id: string; emoji: string; user_id: string }[]>("message_id", "emoji", "user_id");
    },

    async replyCountsForMessages(messageIds: string[]): Promise<Map<string, number>> {
      if (messageIds.length === 0) return new Map();
      const rows = await db("messages")
        .whereIn("parent_message_id", messageIds)
        .whereNull("deleted_at")
        .groupBy("parent_message_id")
        .select<{ parent_message_id: string; c: string }[]>("parent_message_id")
        .count<{ parent_message_id: string; c: string }[]>("id as c");
      return new Map(rows.map((r) => [r.parent_message_id, Number(r.c)]));
    },

    listThread(rootId: string): Promise<MessageRow[]> {
      return db<MessageRow>("messages as m")
        .leftJoin("user as u", "u.id", "m.author_id")
        .where("m.parent_message_id", rootId)
        .select<MessageRow[]>("m.*", "u.name as author_name")
        .orderBy("m.created_at", "asc");
    },

    async pinMessage(channelId: string, messageId: string, userId: string): Promise<void> {
      await db("pinned_messages")
        .insert({ id: generateId("pin"), channel_id: channelId, message_id: messageId, pinned_by_id: userId })
        .onConflict(["channel_id", "message_id"])
        .ignore();
    },

    async unpinMessage(channelId: string, messageId: string): Promise<void> {
      await db("pinned_messages").where({ channel_id: channelId, message_id: messageId }).del();
    },

    listPinned(channelId: string): Promise<MessageRow[]> {
      return db<MessageRow>("pinned_messages as p")
        .join("messages as m", "m.id", "p.message_id")
        .leftJoin("user as u", "u.id", "m.author_id")
        .where("p.channel_id", channelId)
        .select<MessageRow[]>("m.*", "u.name as author_name")
        .orderBy("p.created_at", "desc");
    },

    searchMessages(
      userId: string,
      query: string,
      channelId: string | undefined,
      limit: number,
    ): Promise<MessageRow[]> {
      let q = db<MessageRow>("messages as m")
        .join("channel_members as cm", function () {
          this.on("cm.channel_id", "m.channel_id").andOnVal("cm.user_id", userId);
        })
        .leftJoin("user as u", "u.id", "m.author_id")
        .whereNull("m.deleted_at")
        .whereRaw("m.search_vector @@ plainto_tsquery('simple', ?)", [query])
        .select<MessageRow[]>("m.*", "u.name as author_name")
        .orderBy("m.created_at", "desc")
        .limit(limit);
      if (channelId) q = q.where("m.channel_id", channelId);
      return q;
    },

    findDmChannel(userIds: string[]): Promise<ChannelRow | undefined> {
      return db<ChannelRow>("channels as c")
        .where("c.type", "dm")
        .whereExists(function () {
          this.select("*")
            .from("channel_members as m1")
            .whereRaw("m1.channel_id = c.id")
            .where("m1.user_id", userIds[0]!);
        })
        .whereExists(function () {
          this.select("*")
            .from("channel_members as m2")
            .whereRaw("m2.channel_id = c.id")
            .where("m2.user_id", userIds[1]!);
        })
        .whereRaw("(SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2")
        .first();
    },
  };
}

export type MessagingRepository = ReturnType<typeof messagingRepository>;
