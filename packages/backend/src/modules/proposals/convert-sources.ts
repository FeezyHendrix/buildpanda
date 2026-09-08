import type { Knex } from "knex";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import type { PreconBoqRowDto, PreconProgramme, PreconSession, PreconSnapshot } from "../panda-ai/pdf-takeoff/types.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { Estimate, EstimateItem, JobProfile, PaymentScheduleItem, ProposalPlan, ProposalRow } from "./types.ts";
import { JOB_PROFILES } from "./types.ts";

/**
 * Everything the handoff reads, loaded once so preview and convert see the
 * same picture. Columns that other workstreams add (job_profile,
 * snapshot_file_id, programme_task_id on schedule items) are read only when
 * present, so this module works before and after those land.
 */
export interface ConvertSources {
  proposal: ProposalRow;
  estimate: Estimate | null;
  items: EstimateItem[];
  schedule: PaymentScheduleItem[];
  plans: ProposalPlan[];
  session: PreconSession | null;
  programme: PreconProgramme | null;
  rows: PreconBoqRowDto[];
  jobProfile: JobProfile;
  snapshotFileId: string | null;
  leadTimeByName: Map<string, number>;
}

const RUNNING = new Set(["uploading", "generating"]);

async function optionalColumn<T>(
  db: Knex,
  table: string,
  column: string,
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const present = await db.schema.hasColumn(table, column);
  return present ? read() : fallback;
}

export async function loadConvertSources(
  db: Knex,
  repo: ProposalsRepository,
  proposal: ProposalRow,
  orgId: string,
): Promise<ConvertSources> {
  const estimate = await repo.getActiveEstimate(proposal.id);
  const [items, schedule, plans] = await Promise.all([
    estimate ? repo.getItems(estimate.id) : Promise.resolve([]),
    estimate ? loadSchedule(db, repo, estimate.id) : Promise.resolve([]),
    repo.listPlans(proposal.id),
  ]);

  const precon = preconService(preconRepository(db));
  const sessions: PreconSession[] = await precon.listSessions(orgId, proposal.id);
  // the most recent take-off that finished measuring is the one the handoff uses
  const session = sessions.find((s) => !RUNNING.has(s.status) && s.status !== "failed") ?? null;
  const snapshot: PreconSnapshot | null = session ? await precon.getSnapshot(session.id) : null;
  const programme: PreconProgramme | null = session ? await precon.getProgramme(session.id) : null;

  const jobProfile = await optionalColumn<JobProfile>(
    db,
    "proposals",
    "job_profile",
    async () => {
      const row = await db("proposals").where({ id: proposal.id }).select("job_profile").first<{ job_profile: string | null }>();
      const value = row?.job_profile ?? "full_contract";
      return (JOB_PROFILES as readonly string[]).includes(value) ? (value as JobProfile) : "full_contract";
    },
    "full_contract",
  );

  const snapshotFileId = estimate
    ? await optionalColumn<string | null>(
        db,
        "estimates",
        "snapshot_file_id",
        async () => {
          const row = await db("estimates").where({ id: estimate.id }).select("snapshot_file_id").first<{ snapshot_file_id: string | null }>();
          return row?.snapshot_file_id ?? null;
        },
        null,
      )
    : null;

  return {
    proposal,
    estimate,
    items,
    schedule,
    plans,
    session,
    programme,
    rows: snapshot?.rows ?? [],
    jobProfile,
    snapshotFileId,
    // a brand-new project has no catalogue yet; lead times arrive once the
    // ledger is used, so this stays empty at handoff time
    leadTimeByName: new Map(),
  };
}

/** Schedule items plus the programme milestone they are bound to, when that column exists. */
async function loadSchedule(db: Knex, repo: ProposalsRepository, estimateId: string): Promise<PaymentScheduleItem[]> {
  const schedule = await repo.getSchedule(estimateId);
  return optionalColumn(
    db,
    "estimate_payment_schedule",
    "programme_task_id",
    async () => {
      const links = await db("estimate_payment_schedule")
        .where({ estimate_id: estimateId })
        .select<{ id: string; programme_task_id: string | null }[]>("id", "programme_task_id");
      const byId = new Map(links.map((l) => [l.id, l.programme_task_id]));
      return schedule.map((s) => ({ ...s, programmeTaskId: byId.get(s.id) ?? null }));
    },
    schedule,
  );
}
