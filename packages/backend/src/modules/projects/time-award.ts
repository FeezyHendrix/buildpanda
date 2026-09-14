import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { addCalendarDays, isoDate } from "../../lib/working-days.ts";
import { keyDatesRepository } from "../key-dates/repository.ts";
import { keyDatesService } from "../key-dates/service.ts";
import { projectsRepository } from "./repository.ts";

/**
 * Awarding time against the contract.
 *
 * The project owns its completion date, so the award that moves it lives here
 * rather than in the register that happens to raise the claim — change requests
 * of type `eot_only` call in, and anything else that wins time later can too.
 *
 * An award moves the revised completion date by that many CALENDAR days (a
 * contract extends the Time for Completion; it does not re-plan the working
 * week) and every CONTRACTUAL key date — Practical Completion, sectional
 * completion, defects liability end — moves with it. Nothing else on the
 * programme is touched.
 *
 * `days` is signed: `+14` awards two weeks, `-5` gives five of them back when
 * an award is revised down, so a caller keeping a running applied total only
 * ever sends the difference.
 */
export interface TimeAwardResult {
  revisedCompletionDate: string | null;
  keyDatesMoved: number;
}

export interface TimeAwardDeps {
  dates(projectId: string): Promise<{
    completion_date: string | null;
    revised_completion_date: string | null;
  } | undefined>;
  setRevisedCompletion(projectId: string, date: string | null): Promise<void>;
  /** Moves every contractual key date by the same signed days. */
  shiftContractualKeyDates(projectId: string, days: number): Promise<number>;
}

export async function awardTime(
  projectId: string,
  days: number,
  deps: TimeAwardDeps,
): Promise<TimeAwardResult> {
  const delta = Math.trunc(days);
  const project = await deps.dates(projectId);
  if (!project) throw new NotFoundError("Project");

  const base = project.revised_completion_date ?? project.completion_date;
  const revised =
    delta !== 0 && base ? isoDate(addCalendarDays(`${base}T00:00:00.000Z`, delta)) : base;
  if (delta !== 0 && revised !== project.revised_completion_date) {
    await deps.setRevisedCompletion(projectId, revised);
  }

  const keyDatesMoved = delta === 0 ? 0 : await deps.shiftContractualKeyDates(projectId, delta);
  return { revisedCompletionDate: revised ?? null, keyDatesMoved };
}

/** Wires the award to the real tables. `trx` is the connection or open transaction. */
export function applyTimeAward(
  projectId: string,
  days: number,
  trx: Knex | Knex.Transaction,
): Promise<TimeAwardResult> {
  const db = trx as Knex;
  const projects = projectsRepository(db);
  const keyDates = keyDatesService(keyDatesRepository(db), async () => "");
  return awardTime(projectId, days, {
    dates: (id) => projects.dates(id),
    setRevisedCompletion: (id, date) => projects.setRevisedCompletion(id, date),
    shiftContractualKeyDates: (id, delta) => keyDates.shiftContractual(id, delta),
  });
}
