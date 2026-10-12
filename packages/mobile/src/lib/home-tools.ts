import type Ionicons from "@expo/vector-icons/Ionicons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type HomeToolKey =
  | "tasks"
  | "dailyLog"
  | "materialLog"
  | "updates"
  | "expenses"
  | "schedule"
  | "rfis"
  | "materialOrders"
  | "materialApprovals"
  | "lookAheads"
  | "changeRequests"
  | "plans"
  | "pandaAi";

export interface HomeTool {
  key: HomeToolKey;
  label: string;
  icon: IconName;
  href: string;
  /** Route prefixes that count as opening this tool. */
  paths: string[];
  permission: [resource: string, action: string];
}

/** Every tool the Home screen can surface, in the order a new user sees them. */
export const HOME_TOOLS: readonly HomeTool[] = [
  { key: "dailyLog", label: "Daily log", icon: "clipboard-outline", href: "/tools/daily-log", paths: ["/tools/daily-log"], permission: ["dailyLog", "view"] },
  { key: "tasks", label: "Tasks", icon: "checkbox-outline", href: "/tools/tasks", paths: ["/tools/tasks"], permission: ["tasks", "view"] },
  { key: "materialLog", label: "Material log", icon: "cube-outline", href: "/tools/material-log", paths: ["/tools/material-log"], permission: ["materials", "view"] },
  { key: "updates", label: "Updates", icon: "chatbubbles-outline", href: "/tools/updates", paths: ["/tools/updates"], permission: ["updates", "view"] },
  { key: "expenses", label: "Expenses", icon: "receipt-outline", href: "/tools/expenses", paths: ["/tools/expenses"], permission: ["finances", "viewCosts"] },
  { key: "schedule", label: "Schedule", icon: "calendar-outline", href: "/(tabs)/schedule", paths: ["/tools/schedule", "/schedule"], permission: ["schedule", "view"] },
  { key: "rfis", label: "RFIs", icon: "help-circle-outline", href: "/tools/rfis", paths: ["/tools/rfis"], permission: ["rfis", "view"] },
  { key: "materialOrders", label: "Orders", icon: "cart-outline", href: "/tools/materials", paths: ["/tools/materials"], permission: ["materials", "view"] },
  { key: "materialApprovals", label: "Approvals", icon: "checkmark-done-outline", href: "/tools/material-approvals", paths: ["/tools/material-approvals"], permission: ["materials", "view"] },
  { key: "lookAheads", label: "Look aheads", icon: "list-outline", href: "/tools/look-aheads", paths: ["/tools/look-aheads"], permission: ["schedule", "view"] },
  { key: "changeRequests", label: "Changes", icon: "swap-horizontal-outline", href: "/tools/change-requests", paths: ["/tools/change-requests"], permission: ["change-requests", "view"] },
  { key: "plans", label: "Plans", icon: "map-outline", href: "/tools/plan-review", paths: ["/tools/plan-review"], permission: ["documents", "view"] },
  { key: "pandaAi", label: "Panda AI", icon: "sparkles-outline", href: "/tools/panda-ai", paths: ["/tools/panda-ai"], permission: ["project", "view"] },
];

/** What a new user starts with, before the app has learned anything. */
export function defaultOrder(canManage: boolean): HomeToolKey[] {
  const base: HomeToolKey[] = ["dailyLog", "tasks", "materialLog", "updates"];
  return canManage ? [...base, "expenses"] : base;
}

export function toolForPath(pathname: string): HomeTool | undefined {
  return HOME_TOOLS.find((tool) => tool.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}

/** Opens a tool needs before usage, rather than the defaults, decides the order. */
export const LEARNING_THRESHOLD = 5;
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/** A score that halves every week, so last month's habit fades. */
export function decayedScore(score: number, lastUsedAt: number, now: number): number {
  return score * 0.5 ** (Math.max(0, now - lastUsedAt) / HALF_LIFE_MS);
}

export interface ToolUsage {
  key: string;
  score: number;
  opens: number;
  lastUsedAt: number;
  position: number | null;
  hidden: boolean;
}

/**
 * The order tools appear on Home. A layout the user arranged wins outright.
 * Otherwise the defaults hold until the app has seen enough use to know
 * better, then tools rank by recent use with the defaults breaking ties.
 */
export function rankTools(allowed: readonly HomeToolKey[], usage: readonly ToolUsage[], defaults: readonly HomeToolKey[], now: number): HomeToolKey[] {
  const byKey = new Map(usage.map((row) => [row.key, row]));
  const visible = allowed.filter((key) => !byKey.get(key)?.hidden);
  const baseline = (key: HomeToolKey) => {
    const index = defaults.indexOf(key);
    return index === -1 ? defaults.length + allowed.indexOf(key) : index;
  };

  if (usage.some((row) => row.position !== null)) {
    const placed = (key: HomeToolKey) => byKey.get(key)?.position ?? Number.MAX_SAFE_INTEGER;
    return [...visible].sort((a, b) => placed(a) - placed(b) || baseline(a) - baseline(b));
  }

  const totalOpens = usage.reduce((sum, row) => sum + row.opens, 0);
  if (totalOpens < LEARNING_THRESHOLD) return [...visible].sort((a, b) => baseline(a) - baseline(b));

  const score = (key: HomeToolKey) => {
    const row = byKey.get(key);
    // a default keeps a small head start, so one stray open doesn't bury it
    const head = defaults.includes(key) ? 0.5 : 0;
    return (row ? decayedScore(row.score, row.lastUsedAt, now) : 0) + head;
  };
  return [...visible].sort((a, b) => score(b) - score(a) || baseline(a) - baseline(b));
}
