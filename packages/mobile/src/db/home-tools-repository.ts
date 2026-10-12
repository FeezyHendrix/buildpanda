import { eq, isNotNull } from "drizzle-orm";
import { decayedScore } from "@/lib/home-tools";
import type { Db } from "./client";
import { homeToolUsage } from "./schema";

export const homeToolsRepository = {
  listQuery: (db: Db) => db.select().from(homeToolUsage),

  /** One open: decay what was there, then add one. */
  async recordOpen(db: Db, key: string, now = Date.now()): Promise<void> {
    await db.transaction((tx) => {
      const [row] = tx.select().from(homeToolUsage).where(eq(homeToolUsage.key, key)).limit(1).all();
      const score = (row ? decayedScore(row.score, row.lastUsedAt, now) : 0) + 1;
      tx.insert(homeToolUsage)
        .values({ key, score, opens: 1, lastUsedAt: now })
        .onConflictDoUpdate({ target: homeToolUsage.key, set: { score, opens: (row?.opens ?? 0) + 1, lastUsedAt: now } })
        .run();
    });
  },

  /** The user's own arrangement: every listed key gets its place. */
  async saveLayout(db: Db, order: readonly string[], hidden: ReadonlySet<string>): Promise<void> {
    await db.transaction((tx) => {
      order.forEach((key, position) => {
        const isHidden = hidden.has(key);
        tx.insert(homeToolUsage).values({ key, position, hidden: isHidden })
          .onConflictDoUpdate({ target: homeToolUsage.key, set: { position, hidden: isHidden } }).run();
      });
    });
  },

  /** Back to learning from use; what was learned so far is kept. */
  async resetLayout(db: Db): Promise<void> {
    await db.update(homeToolUsage).set({ position: null, hidden: false }).where(isNotNull(homeToolUsage.key));
  },
};
