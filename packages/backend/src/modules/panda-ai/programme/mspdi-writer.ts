import type { DependencyType } from "../../activities/types.ts";

// Writes Microsoft Project XML (MSPDI) — the inverse of parser.ts, which reads
// it. MSPDI is the only interchange format modern MS Project opens directly:
// .mpp is proprietary binary and .mpx was dropped after 2010. Hand-built rather
// than pulled from a library because the document is a flat element tree and no
// maintained npm package writes MSPDI (they all only read it).

const MSPDI_NS = "http://schemas.microsoft.com/project/2007";
const HOURS_PER_DAY = 8;
const MINUTES_PER_DAY = 60 * HOURS_PER_DAY;

/** MS Project maps its link types by ordinal, not by name. */
const LINK_TYPE: Record<DependencyType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

export interface MspdiTask {
  uid: number;
  name: string;
  outlineLevel: number;
  outlineNumber: string | null;
  start: Date;
  finish: Date;
  durationDays: number | null;
  percentComplete: number;
  isMilestone: boolean;
  isSummary: boolean;
  predecessors: Array<{ uid: number; type: DependencyType; lagDays: number }>;
}

export interface MspdiDocument {
  name: string;
  start: Date | null;
  finish: Date | null;
  tasks: MspdiTask[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * MS Project reads these as local wall-clock time. Emitting an offset or a
 * trailing `Z` makes it shift every date by the reader's timezone, so the
 * datetime is written deliberately without one.
 */
function xmlDateTime(value: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` +
    `T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
  );
}

/** MSPDI durations are ISO-8601 periods measured in working hours, not days. */
function xmlDuration(days: number | null): string {
  const hours = Math.max(0, Math.round((days ?? 0) * HOURS_PER_DAY));
  return `PT${hours}H0M0S`;
}

function el(name: string, value: string | number | boolean): string {
  const text = typeof value === "string" ? escapeXml(value) : String(value);
  return `<${name}>${text}</${name}>`;
}

function taskXml(task: MspdiTask): string {
  const parts = [
    el("UID", task.uid),
    el("ID", task.uid),
    el("Name", task.name),
    el("Type", 1),
    el("Start", xmlDateTime(task.start)),
    el("Finish", xmlDateTime(task.finish)),
    el("Duration", xmlDuration(task.isMilestone ? 0 : task.durationDays)),
    el("DurationFormat", 7),
    el("OutlineLevel", task.outlineLevel),
    el("PercentComplete", task.percentComplete),
    el("Milestone", task.isMilestone),
    el("Summary", task.isSummary),
  ];
  if (task.outlineNumber) parts.push(el("OutlineNumber", task.outlineNumber));

  for (const link of task.predecessors) {
    const lagMinutes = Math.round(link.lagDays * MINUTES_PER_DAY);
    parts.push(
      "<PredecessorLink>" +
        el("PredecessorUID", link.uid) +
        el("Type", LINK_TYPE[link.type]) +
        // LinkLag is expressed in tenths of a minute.
        el("LinkLag", lagMinutes * 10) +
        el("LagFormat", 7) +
        "</PredecessorLink>",
    );
  }

  return `<Task>${parts.join("")}</Task>`;
}

export function buildMspdiXml(doc: MspdiDocument): string {
  const header = [
    el("SaveVersion", 4),
    el("Name", doc.name),
    el("Title", doc.name),
    el("ScheduleFromStart", true),
    el("CalendarUID", 1),
  ];
  if (doc.start) header.push(el("StartDate", xmlDateTime(doc.start)));
  if (doc.finish) header.push(el("FinishDate", xmlDateTime(doc.finish)));

  // MS Project reports a corrupt file when CalendarUID has no matching entry.
  const calendars =
    "<Calendars><Calendar>" +
    el("UID", 1) +
    el("Name", "Standard") +
    el("IsBaseCalendar", true) +
    "</Calendar></Calendars>";

  const tasks = `<Tasks>${doc.tasks.map(taskXml).join("")}</Tasks>`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Project xmlns="${MSPDI_NS}">` +
    header.join("") +
    calendars +
    tasks +
    "<Resources/><Assignments/>" +
    "</Project>"
  );
}
