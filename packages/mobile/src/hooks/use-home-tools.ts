import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { getDbOwner, type Db } from "@/db/client";
import { homeToolsRepository } from "@/db/home-tools-repository";
import { useLocalDb } from "@/db/provider";
import { defaultOrder, HOME_TOOLS, rankTools, toolForPath, type HomeTool, type HomeToolKey } from "@/lib/home-tools";
import { useProjectAccess } from "./use-project-access";

/** Counts one open each time the user goes into a tool, not every screen inside it. */
export function useTrackToolOpens() {
  const pathname = usePathname();
  const { db } = useLocalDb();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const tool = toolForPath(pathname);
    const key = tool?.key ?? null;
    if (key === last.current) return;
    last.current = key;
    if (key && db) void homeToolsRepository.recordOpen(db, key).catch(() => undefined);
  }, [pathname, db]);
}

export function useAllowedTools(): HomeTool[] {
  const { allows } = useProjectAccess();
  return useMemo(() => HOME_TOOLS.filter((tool) => allows(tool.permission)), [allows]);
}

/**
 * The order Home shows tools in. Worked out once per day and then held for
 * the session: tiles that move while a thumb is reaching for them are worse
 * than a fixed order. A layout the user saves takes effect straight away.
 */
let frozen: { day: string; signature: string; order: HomeToolKey[] } | null = null;

export function useHomeToolOrder(db: Db) {
  const allowed = useAllowedTools();
  const { can } = useProjectAccess();
  const query = useMemo(() => homeToolsRepository.listQuery(db), [db]);
  const live = useLiveQuery(query, [query]);
  const rows = live.data;

  const order = useMemo(() => {
    if (!rows) return null;
    const usage = rows.map((row) => ({ ...row, hidden: Boolean(row.hidden) }));
    const allowedKeys = allowed.map((tool) => tool.key);
    const manual = usage.filter((row) => row.position !== null || row.hidden).map((row) => `${row.key}:${row.position}:${row.hidden}`);
    // the frozen order is reused only while the user's own layout and access are unchanged
    const signature = `${getDbOwner(db) ?? ""}|${allowedKeys.join(",")}|${manual.sort().join(",")}`;
    const day = new Date().toDateString();
    if (frozen && frozen.day === day && frozen.signature === signature) return frozen.order;
    const next = rankTools(allowedKeys, usage, defaultOrder(can("finances", "manage")), Date.now());
    frozen = { day, signature, order: next };
    return next;
  }, [rows, allowed, can, db]);

  const byKey = useMemo(() => new Map(allowed.map((tool) => [tool.key, tool])), [allowed]);
  return {
    tools: (order ?? []).flatMap((key) => byKey.get(key) ?? []),
    isPending: order === null,
    hiddenKeys: new Set((rows ?? []).filter((row) => row.hidden).map((row) => row.key)),
  };
}
