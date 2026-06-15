import type { Knex } from "knex";
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
  references: string;
  mentions: string;
  attachments: string;
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
  };
}

export type MessagingRepository = ReturnType<typeof messagingRepository>;
