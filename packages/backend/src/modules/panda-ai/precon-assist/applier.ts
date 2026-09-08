import type { preconService } from "../pdf-takeoff/service.ts";
import type { CreateRowBody, PreconBoqRowDto, PreconProgrammeTask, RowType } from "../pdf-takeoff/types.ts";
import {
  PROGRAMME_TASK_APPLIABLE_FIELDS,
  type AppliedChange,
  type AssistChange,
  type UndoStep,
} from "./types.ts";

export type PreconService = ReturnType<typeof preconService>;

export interface LiveState {
  rows: Map<string, PreconBoqRowDto>;
  tasks: Map<string, PreconProgrammeTask>;
}

// The resource/action a change needs. Verifying or rejecting is a sign-off and
// carries its own grant; everything else is an edit.
export function permissionFor(change: AssistChange): [string, string] {
  const status = change.after["status"];
  if (change.op === "update" && (status === "verified" || status === "rejected")) return ["takeoffs", "verify"];
  return ["takeoffs", "edit"];
}

const skip = (index: number, reason: string): AppliedChange => ({ index, outcome: "skipped", reason });
const done = (index: number, undo?: UndoStep): AppliedChange => ({ index, outcome: "applied", undo });

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function applyBoqRow(index: number, change: AssistChange, live: LiveState, precon: PreconService, actor: string): Promise<AppliedChange> {
  if (change.op === "create") {
    const a = change.after;
    const body: CreateRowBody = {
      description: String(a["description"] ?? ""),
      rowType: (a["rowType"] as RowType | undefined) ?? "item",
      elementGroup: typeof a["elementGroup"] === "string" ? a["elementGroup"] : undefined,
      code: typeof a["code"] === "string" ? a["code"] : undefined,
      unit: typeof a["unit"] === "string" ? a["unit"] : undefined,
      qty: numberOrUndefined(a["qty"]),
      rate: numberOrUndefined(a["rate"]),
    };
    const created = await precon.createRow(String(a["billId"]), body, actor);
    return done(index, { kind: "remove", id: created.id });
  }
  const row = change.id ? live.rows.get(change.id) : undefined;
  if (!row) return skip(index, "Line no longer exists");
  if (change.op === "delete") {
    await precon.removeRow(row.id, actor);
    return done(index, {
      kind: "recreate",
      before: {
        billId: row.billId,
        rowType: row.rowType,
        description: row.description,
        elementGroup: row.elementGroup,
        code: row.code,
        unit: row.unit,
        qty: row.qty,
        rate: row.rate,
      },
    });
  }
  const { status, ...fields } = change.after;
  let version = row.version;
  const undoFields: Record<string, unknown> = {};
  if (Object.keys(fields).length > 0) {
    for (const key of Object.keys(fields)) undoFields[key] = (row as unknown as Record<string, unknown>)[key];
    const updated = await precon.updateRow(
      row.id,
      {
        version,
        changes: {
          description: typeof fields["description"] === "string" ? fields["description"] : undefined,
          unit: typeof fields["unit"] === "string" ? fields["unit"] : undefined,
          qty: numberOrUndefined(fields["qty"]),
          rate: numberOrUndefined(fields["rate"]),
        },
      },
      actor,
    );
    version = updated.version;
  }
  let statusUndo: UndoStep["kind"] | null = null;
  if (status === "verified") {
    await precon.verifyRow(row.id, version, actor);
    statusUndo = row.status === "rejected" ? "reject" : "update";
  } else if (status === "rejected") {
    await precon.rejectRow(row.id, version, actor);
    statusUndo = row.status === "verified" ? "verify" : "update";
  }
  return done(index, { kind: statusUndo ?? "update", id: row.id, before: undoFields });
}

async function applyProgrammeTask(index: number, change: AssistChange, live: LiveState, precon: PreconService, actor: string): Promise<AppliedChange> {
  if (change.op !== "update") return skip(index, "Creating or deleting programme tasks is not available yet");
  const task = change.id ? live.tasks.get(change.id) : undefined;
  if (!task) return skip(index, "Task no longer exists");
  const appliable = new Set<string>(PROGRAMME_TASK_APPLIABLE_FIELDS);
  const unsupported = Object.keys(change.after).filter((k) => !appliable.has(k));
  const { status, ...fields } = Object.fromEntries(Object.entries(change.after).filter(([k]) => appliable.has(k)));
  if (Object.keys(fields).length === 0 && status === undefined) {
    return skip(index, `Fields not editable yet: ${unsupported.join(", ")}`);
  }
  let version = task.version;
  const undoFields: Record<string, unknown> = {};
  if (Object.keys(fields).length > 0) {
    for (const key of Object.keys(fields)) undoFields[key] = (task as unknown as Record<string, unknown>)[key];
    const updated = await precon.updateProgrammeTask(
      task.id,
      version,
      {
        name: typeof fields["name"] === "string" ? fields["name"] : undefined,
        durationDays: numberOrUndefined(fields["durationDays"]),
        isMilestone: typeof fields["isMilestone"] === "boolean" ? fields["isMilestone"] : undefined,
        basis: typeof fields["basis"] === "string" ? fields["basis"] : undefined,
      },
      actor,
    );
    version = updated.version;
  }
  if (status === "verified" || status === "rejected") {
    await precon.setProgrammeTaskStatus(task.id, version, status, actor);
  }
  const result = done(index, { kind: "update", id: task.id, before: undoFields });
  if (unsupported.length > 0) result.reason = `Applied partially; not editable yet: ${unsupported.join(", ")}`;
  return result;
}

export async function applyChange(index: number, change: AssistChange, live: LiveState, precon: PreconService, actor: string): Promise<AppliedChange> {
  if (change.entity === "boq_row") return applyBoqRow(index, change, live, precon, actor);
  if (change.entity === "programme_task") return applyProgrammeTask(index, change, live, precon, actor);
  return skip(index, `${change.entity} changes are not supported yet`);
}

// Reverses one applied change. Status changes can only be reversed to a state
// the services expose (verify / reject); a line that was AI-drafted before
// verification comes back as an edited row, which the UI shows as needs review.
export async function undoChange(step: UndoStep, entity: AssistChange["entity"], live: LiveState, precon: PreconService, actor: string): Promise<AppliedChange["outcome"]> {
  if (step.kind === "remove" && step.id) {
    if (live.rows.has(step.id)) await precon.removeRow(step.id, actor);
    return "applied";
  }
  if (step.kind === "recreate" && step.before) {
    const b = step.before;
    await precon.createRow(
      String(b["billId"]),
      {
        description: String(b["description"] ?? ""),
        rowType: (b["rowType"] as RowType | undefined) ?? "item",
        elementGroup: typeof b["elementGroup"] === "string" ? b["elementGroup"] : undefined,
        code: typeof b["code"] === "string" ? b["code"] : undefined,
        unit: typeof b["unit"] === "string" ? b["unit"] : undefined,
        qty: numberOrUndefined(b["qty"]),
        rate: numberOrUndefined(b["rate"]),
      },
      actor,
    );
    return "applied";
  }
  if (!step.id) return "skipped";
  if (entity === "boq_row") {
    const row = live.rows.get(step.id);
    if (!row) return "skipped";
    let version = row.version;
    if (step.before && Object.keys(step.before).length > 0) {
      const b = step.before;
      const updated = await precon.updateRow(
        row.id,
        {
          version,
          changes: {
            description: typeof b["description"] === "string" ? b["description"] : undefined,
            unit: typeof b["unit"] === "string" ? b["unit"] : undefined,
            qty: numberOrUndefined(b["qty"]),
            rate: numberOrUndefined(b["rate"]),
          },
        },
        actor,
      );
      version = updated.version;
    }
    if (step.kind === "verify") await precon.verifyRow(row.id, version, actor);
    if (step.kind === "reject") await precon.rejectRow(row.id, version, actor);
    return "applied";
  }
  const task = live.tasks.get(step.id);
  if (!task || !step.before) return "skipped";
  const b = step.before;
  await precon.updateProgrammeTask(
    task.id,
    task.version,
    {
      name: typeof b["name"] === "string" ? b["name"] : undefined,
      durationDays: numberOrUndefined(b["durationDays"]),
      isMilestone: typeof b["isMilestone"] === "boolean" ? b["isMilestone"] : undefined,
      basis: typeof b["basis"] === "string" ? b["basis"] : undefined,
    },
    actor,
  );
  return "applied";
}
