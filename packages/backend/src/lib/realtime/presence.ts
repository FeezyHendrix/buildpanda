export interface PresentUser {
  id: string;
  name: string;
  rowId: string | null;
}

interface Entry {
  name: string;
  rowId: string | null;
  // open sockets this user has on the channel: a second tab must not make
  // the first tab's close look like the user left
  sockets: number;
}

/**
 * Who is on each channel right now, and which bill line each of them is on.
 * In-memory bookkeeping only: it lives and dies with the process, and a
 * websocket that closes takes its user with it. Every mutation returns the
 * channel's user list when something visible changed, and null when nothing
 * did, so the caller publishes only real changes.
 */
export class PresenceTracker {
  private readonly channels = new Map<string, Map<string, Entry>>();

  list(channelId: string): PresentUser[] {
    const users = this.channels.get(channelId);
    if (!users) return [];
    return [...users.entries()].map(([id, e]) => ({ id, name: e.name, rowId: e.rowId }));
  }

  join(channelId: string, user: { id: string; name: string }): PresentUser[] | null {
    const users = this.channels.get(channelId) ?? new Map<string, Entry>();
    this.channels.set(channelId, users);
    const existing = users.get(user.id);
    if (existing) {
      existing.sockets += 1;
      existing.name = user.name;
      return null;
    }
    users.set(user.id, { name: user.name, rowId: null, sockets: 1 });
    return this.list(channelId);
  }

  leave(channelId: string, userId: string): PresentUser[] | null {
    const users = this.channels.get(channelId);
    const entry = users?.get(userId);
    if (!users || !entry) return null;
    entry.sockets -= 1;
    if (entry.sockets > 0) return null;
    users.delete(userId);
    if (users.size === 0) this.channels.delete(channelId);
    return this.list(channelId);
  }

  // Focus is where the user is looking, not where they are: a user who is
  // not on the channel (no live socket) has nothing to focus.
  focus(channelId: string, userId: string, rowId: string | null): PresentUser[] | null {
    const entry = this.channels.get(channelId)?.get(userId);
    if (!entry) return null;
    if (entry.rowId === rowId) return null;
    entry.rowId = rowId;
    return this.list(channelId);
  }
}
