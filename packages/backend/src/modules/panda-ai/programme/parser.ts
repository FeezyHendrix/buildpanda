import * as XLSX from "xlsx";

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface ProgrammeDependency {
  refId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ProgrammeTask {
  refId: string;
  wbs: string;
  outlineLevel: number;
  name: string;
  isSummary: boolean;
  isMilestone: boolean;
  start: string | null;
  finish: string | null;
  durationDays: number | null;
  percentComplete: number;
  predecessors: ProgrammeDependency[];
  cost: number;
}

export interface ParsedProgramme {
  projectName: string | null;
  start: string | null;
  finish: string | null;
  tasks: ProgrammeTask[];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function depType(name: unknown): DependencyType {
  const t = String(name ?? "").toUpperCase();
  if (t.includes("SS")) return "SS";
  if (t.includes("FF")) return "FF";
  if (t.includes("SF")) return "SF";
  return "FS";
}

const MINUTES_PER_DAY = 480;

function durationToDays(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 200) return Math.round((n / MINUTES_PER_DAY) * 10) / 10;
  return n;
}

interface DProjectTask {
  uid?: number | string;
  id?: number | string;
  name?: string;
  wbs?: string;
  outlineNumber?: string;
  outlineLevel?: number;
  start?: string;
  finish?: string;
  duration?: unknown;
  percentComplete?: number;
  milestone?: boolean;
  summary?: boolean;
  cost?: number;
  fixedCost?: number;
  predecessors?: Array<{ predecessorUid?: number | string; uid?: number | string; typeName?: string; lag?: number }>;
}

export async function parseMppBuffer(buffer: Buffer, tmpDir: string): Promise<ParsedProgramme> {
  const { convert } = await import("@byteink/mppjs");
  const DProject = (await import("dproject")).default;
  const { writeFileSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const mppPath = join(tmpDir, "in.mpp");
  const xmlPath = join(tmpDir, "out.xml");
  writeFileSync(mppPath, buffer);
  try {
    await convert(mppPath, xmlPath, { timeoutMs: 90_000 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT" || code === "ENOEXEC") {
      throw new Error(
        "Microsoft Project (.mpp) parsing is unavailable on this server. Please export your programme to Excel (.xls or .xlsx) and upload that instead.",
      );
    }
    throw error;
  }
  const xml = readFileSync(xmlPath, "utf8");
  const project = DProject.parse(xml) as { name?: string; title?: string; tasks?: DProjectTask[] };
  const rawTasks = project.tasks ?? [];

  const tasks: ProgrammeTask[] = rawTasks
    .filter((t) => (t.name ?? "").trim() && (t.outlineLevel ?? 0) >= 1)
    .map((t) => {
      const refId = String(t.uid ?? t.id ?? t.wbs ?? "");
      const start = toIso(t.start);
      const finish = toIso(t.finish);
      const minutes = durationToDays(t.duration);
      return {
        refId,
        wbs: String(t.wbs ?? t.outlineNumber ?? ""),
        outlineLevel: Number(t.outlineLevel ?? 1),
        name: (t.name ?? "").trim(),
        isSummary: Boolean(t.summary),
        isMilestone: Boolean(t.milestone) || minutes === 0,
        start,
        finish,
        durationDays: minutes,
        percentComplete: Math.max(0, Math.min(100, Number(t.percentComplete ?? 0))),
        predecessors: (t.predecessors ?? []).map((p) => ({
          refId: String(p.predecessorUid ?? p.uid ?? ""),
          type: depType(p.typeName),
          lagDays: Number(p.lag ?? 0) / MINUTES_PER_DAY,
        })),
        cost: Number(t.cost ?? t.fixedCost ?? 0),
      };
    });

  return {
    projectName: project.name ?? project.title ?? null,
    start: tasks.reduce<string | null>((min, t) => (t.start && (!min || t.start < min) ? t.start : min), null),
    finish: tasks.reduce<string | null>((max, t) => (t.finish && (!max || t.finish > max) ? t.finish : max), null),
    tasks,
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function findColumns(grid: unknown[][]): { row: number; name: number; start: number; finish: number; dur: number } | null {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const cells = grid[i]!.map((c) => str(c).toLowerCase());
    const name = cells.findIndex((c) => c.includes("task") || c.includes("activity") || c.includes("description") || c === "name");
    const start = cells.findIndex((c) => c.includes("start"));
    const finish = cells.findIndex((c) => c.includes("end") || c.includes("finish"));
    const dur = cells.findIndex((c) => c.includes("duration") || c.includes("days"));
    if (name >= 0 && (start >= 0 || dur >= 0)) {
      return { row: i, name, start, finish, dur };
    }
  }
  return null;
}

export function parseXlsBuffer(buffer: Buffer): ParsedProgramme {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const tasks: ProgrammeTask[] = [];
  let projectName: string | null = null;

  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, { header: 1, defval: "" });
    const cols = findColumns(grid);
    if (!cols) continue;
    if (!projectName) projectName = sheetName;

    for (let i = cols.row + 1; i < grid.length; i++) {
      const r = grid[i]!;
      const name = str(r[cols.name]);
      if (!name) continue;
      const start = cols.start >= 0 ? toIso(r[cols.start]) : null;
      const finish = cols.finish >= 0 ? toIso(r[cols.finish]) : null;
      const durationDays = cols.dur >= 0 ? durationToDays(r[cols.dur]) : null;
      if (!start && !durationDays) continue;
      tasks.push({
        refId: String(tasks.length + 1),
        wbs: String(tasks.length + 1),
        outlineLevel: 1,
        name,
        isSummary: false,
        isMilestone: durationDays === 0,
        start,
        finish,
        durationDays,
        percentComplete: 0,
        predecessors: [],
        cost: 0,
      });
    }
    if (tasks.length > 0) break;
  }

  return {
    projectName,
    start: tasks.reduce<string | null>((min, t) => (t.start && (!min || t.start < min) ? t.start : min), null),
    finish: tasks.reduce<string | null>((max, t) => (t.finish && (!max || t.finish > max) ? t.finish : max), null),
    tasks,
  };
}
