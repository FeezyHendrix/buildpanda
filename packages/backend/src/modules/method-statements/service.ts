import type { ZodType } from "zod";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { LlmMessage } from "../../lib/llm.ts";
import type { MethodStatementPatch, MethodStatementsRepository, PhasePlanPatch } from "./repository.ts";
import {
  highRiskTasks,
  methodStatementDraftSchema,
  methodStatementMessages,
  phasePlanDraftSchema,
  phasePlanMessages,
} from "./safety-draft.ts";
import type {
  MethodStatement,
  MethodStatementRow,
  MethodStep,
  PhasePlan,
  PhasePlanRow,
  SafetyDraftContext,
  SafetyScope,
  UpsertMethodStatementInput,
  UpsertPhasePlanInput,
} from "./types.ts";

export type SafetyDrafter = <T>(messages: LlmMessage[], schema: ZodType<T>) => Promise<{ data: T } | null>;

const toIso = (value: Date | string | null): string | null => (value ? new Date(value).toISOString() : null);

function normaliseSteps(steps: Array<Partial<MethodStep> & { text: string }>): MethodStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    text: step.text.trim(),
    controls: (step.controls ?? "").trim(),
    ppe: (step.ppe ?? "").trim(),
  }));
}

export function toMethodStatement(r: MethodStatementRow): MethodStatement {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    projectId: r.project_id,
    activityName: r.activity_name,
    programmeTaskId: r.programme_task_id,
    activityId: r.activity_id,
    hazards: r.hazards ?? [],
    steps: (r.steps ?? []).map((s, i) => ({ ...s, order: s.order ?? i + 1 })),
    origin: r.origin,
    status: r.status,
    confirmedBy: r.confirmed_by,
    confirmedAt: toIso(r.confirmed_at),
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function toPhasePlan(r: PhasePlanRow): PhasePlan {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    projectId: r.project_id,
    keyDatesNote: r.key_dates_note,
    siteRules: r.site_rules,
    welfare: r.welfare,
    firstAid: r.first_aid,
    servicesIsolation: r.services_isolation,
    asbestosNote: r.asbestos_note,
    hazards: r.hazards ?? [],
    supervision: r.supervision,
    emergencyContacts: r.emergency_contacts ?? [],
    origin: r.origin,
    status: r.status,
    confirmedBy: r.confirmed_by,
    confirmedAt: toIso(r.confirmed_at),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const scopeIds = (scope: SafetyScope) => ({
  proposal_id: scope.proposalId ?? null,
  project_id: scope.projectId ?? null,
});

function inScope(row: { proposal_id: string | null; project_id: string | null }, scope: SafetyScope): boolean {
  return scope.proposalId ? row.proposal_id === scope.proposalId : row.project_id === scope.projectId;
}

export function methodStatementsService(repo: MethodStatementsRepository, deps: { draft?: SafetyDrafter } = {}) {
  async function requireStatement(scope: SafetyScope, id: string): Promise<MethodStatementRow> {
    const row = await repo.findById(id);
    if (!row || !inScope(row, scope)) throw new NotFoundError("Method statement");
    return row;
  }

  function planPatch(input: UpsertPhasePlanInput): PhasePlanPatch {
    const patch: PhasePlanPatch = {};
    if (input.keyDatesNote !== undefined) patch.key_dates_note = input.keyDatesNote;
    if (input.siteRules !== undefined) patch.site_rules = input.siteRules;
    if (input.welfare !== undefined) patch.welfare = input.welfare;
    if (input.firstAid !== undefined) patch.first_aid = input.firstAid;
    if (input.servicesIsolation !== undefined) patch.services_isolation = input.servicesIsolation;
    if (input.asbestosNote !== undefined) patch.asbestos_note = input.asbestosNote;
    if (input.hazards !== undefined) patch.hazards = input.hazards;
    if (input.supervision !== undefined) patch.supervision = input.supervision;
    if (input.emergencyContacts !== undefined) patch.emergency_contacts = input.emergencyContacts;
    return patch;
  }

  return {
    async list(scope: SafetyScope): Promise<MethodStatement[]> {
      return (await repo.listByScope(scope)).map(toMethodStatement);
    },

    // A person writing a statement by hand starts at "edited": the text is
    // theirs, there is no AI draft to distinguish it from.
    async create(scope: SafetyScope, input: UpsertMethodStatementInput, actor: string): Promise<MethodStatement> {
      if (!input.activityName?.trim()) throw new BadRequestError("An activity name is required");
      const row = await repo.insert({
        id: generateId("mst"),
        ...scopeIds(scope),
        activity_name: input.activityName.trim(),
        programme_task_id: input.programmeTaskId ?? null,
        activity_id: input.activityId ?? null,
        hazards: input.hazards ?? [],
        steps: normaliseSteps(input.steps ?? []),
        origin: "manual",
        status: "edited",
        created_by: actor,
      });
      return toMethodStatement(row);
    },

    // Every field is editable. Editing a confirmed statement reopens it so the
    // sign-off is never carried onto text the signer did not read.
    async edit(scope: SafetyScope, id: string, input: UpsertMethodStatementInput): Promise<MethodStatement> {
      await requireStatement(scope, id);
      const patch: MethodStatementPatch = { status: "edited", confirmed_at: null, confirmed_by: null };
      if (input.activityName !== undefined) {
        if (!input.activityName.trim()) throw new BadRequestError("An activity name is required");
        patch.activity_name = input.activityName.trim();
      }
      if (input.programmeTaskId !== undefined) patch.programme_task_id = input.programmeTaskId;
      if (input.activityId !== undefined) patch.activity_id = input.activityId;
      if (input.hazards !== undefined) patch.hazards = input.hazards;
      if (input.steps !== undefined) patch.steps = normaliseSteps(input.steps);
      const row = await repo.update(id, patch);
      if (!row) throw new NotFoundError("Method statement");
      return toMethodStatement(row);
    },

    async confirm(scope: SafetyScope, id: string, actor: string): Promise<MethodStatement> {
      await requireStatement(scope, id);
      const row = await repo.update(id, { status: "confirmed", confirmed_by: actor, confirmed_at: new Date() });
      if (!row) throw new NotFoundError("Method statement");
      return toMethodStatement(row);
    },

    async remove(scope: SafetyScope, id: string): Promise<void> {
      await requireStatement(scope, id);
      await repo.remove(id);
    },

    // One statement per high-risk programme task. Tasks that already have a
    // statement are skipped so a redraft never duplicates a person's edits.
    async draft(scope: SafetyScope, ctx: SafetyDraftContext, actor: string): Promise<MethodStatement[]> {
      if (!deps.draft) throw new BadRequestError("Panda AI drafting is not configured");
      const existing = new Set((await repo.listByScope(scope)).map((s) => s.activity_name.toLowerCase()));
      const candidates = highRiskTasks(ctx.programmeTasks).filter((name) => !existing.has(name.toLowerCase()));
      if (candidates.length === 0) {
        throw new BadRequestError("No high-risk activities without a method statement were found in the programme");
      }
      const response = await deps.draft(methodStatementMessages(ctx, candidates), methodStatementDraftSchema);
      if (!response) throw new BadRequestError("Panda AI returned no method statements; try again");
      const allowed = new Set(candidates.map((c) => c.toLowerCase()));
      const rows = await repo.insertMany(
        response.data.statements
          .filter((s) => allowed.has(s.activityName.toLowerCase()))
          .map((s) => ({
            id: generateId("mst"),
            ...scopeIds(scope),
            activity_name: s.activityName,
            programme_task_id: ctx.programmeTaskIds[s.activityName] ?? null,
            activity_id: null,
            hazards: s.hazards,
            steps: normaliseSteps(s.steps),
            origin: "ai" as const,
            status: "draft" as const,
            created_by: actor,
          })),
      );
      return rows.map(toMethodStatement);
    },

    // ---- construction phase plan ----
    async getPhasePlan(scope: SafetyScope): Promise<PhasePlan | null> {
      const row = await repo.phasePlanByScope(scope);
      return row ? toPhasePlan(row) : null;
    },

    async upsertPhasePlan(scope: SafetyScope, input: UpsertPhasePlanInput): Promise<PhasePlan> {
      const existing = await repo.phasePlanByScope(scope);
      if (existing) {
        const row = await repo.updatePhasePlan(existing.id, {
          ...planPatch(input),
          status: "edited",
          confirmed_at: null,
          confirmed_by: null,
        });
        if (!row) throw new NotFoundError("Construction phase plan");
        return toPhasePlan(row);
      }
      const row = await repo.insertPhasePlan({
        id: generateId("cpp"),
        ...scopeIds(scope),
        key_dates_note: input.keyDatesNote ?? null,
        site_rules: input.siteRules ?? null,
        welfare: input.welfare ?? null,
        first_aid: input.firstAid ?? null,
        services_isolation: input.servicesIsolation ?? null,
        asbestos_note: input.asbestosNote ?? null,
        hazards: input.hazards ?? [],
        supervision: input.supervision ?? null,
        emergency_contacts: input.emergencyContacts ?? [],
        origin: "manual",
        status: "edited",
      });
      return toPhasePlan(row);
    },

    async confirmPhasePlan(scope: SafetyScope, actor: string): Promise<PhasePlan> {
      const existing = await repo.phasePlanByScope(scope);
      if (!existing) throw new NotFoundError("Construction phase plan");
      const row = await repo.updatePhasePlan(existing.id, {
        status: "confirmed",
        confirmed_by: actor,
        confirmed_at: new Date(),
      });
      if (!row) throw new NotFoundError("Construction phase plan");
      return toPhasePlan(row);
    },

    async draftPhasePlan(scope: SafetyScope, ctx: SafetyDraftContext): Promise<PhasePlan> {
      if (!deps.draft) throw new BadRequestError("Panda AI drafting is not configured");
      const response = await deps.draft(phasePlanMessages(ctx), phasePlanDraftSchema);
      if (!response) throw new BadRequestError("Panda AI returned no phase plan; try again");
      const d = response.data;
      const existing = await repo.phasePlanByScope(scope);
      const fields = {
        key_dates_note: d.keyDatesNote,
        site_rules: d.siteRules,
        welfare: d.welfare,
        first_aid: d.firstAid,
        services_isolation: d.servicesIsolation,
        asbestos_note: d.asbestosNote,
        hazards: d.hazards,
        supervision: d.supervision,
      };
      const row = existing
        ? await repo.updatePhasePlan(existing.id, { ...fields, origin: "ai", status: "draft", confirmed_at: null, confirmed_by: null })
        : await repo.insertPhasePlan({
            id: generateId("cpp"),
            ...scopeIds(scope),
            ...fields,
            emergency_contacts: [],
            origin: "ai",
            status: "draft",
          });
      if (!row) throw new NotFoundError("Construction phase plan");
      return toPhasePlan(row);
    },

    // Handoff: copy statements and the phase plan onto the project. Confirmed
    // rows travel first; when nothing was confirmed everything travels, so the
    // site never opens without the safety pack the proposal already had.
    async carryToProject(proposalId: string, projectId: string): Promise<{ statements: number; phasePlan: boolean }> {
      const rows = await repo.listByScope({ proposalId });
      const confirmed = rows.filter((r) => r.status === "confirmed");
      const source = confirmed.length > 0 ? confirmed : rows;
      const created = await repo.insertMany(
        source.map((r) => ({
          id: generateId("mst"),
          proposal_id: null,
          project_id: projectId,
          activity_name: r.activity_name,
          programme_task_id: r.programme_task_id,
          activity_id: null,
          hazards: r.hazards ?? [],
          steps: r.steps ?? [],
          origin: r.origin,
          status: r.status,
          created_by: r.created_by,
        })),
      );
      const plan = await repo.phasePlanByScope({ proposalId });
      let phasePlan = false;
      if (plan && !(await repo.phasePlanByScope({ projectId }))) {
        await repo.insertPhasePlan({
          id: generateId("cpp"),
          proposal_id: null,
          project_id: projectId,
          key_dates_note: plan.key_dates_note,
          site_rules: plan.site_rules,
          welfare: plan.welfare,
          first_aid: plan.first_aid,
          services_isolation: plan.services_isolation,
          asbestos_note: plan.asbestos_note,
          hazards: plan.hazards ?? [],
          supervision: plan.supervision,
          emergency_contacts: plan.emergency_contacts ?? [],
          origin: plan.origin,
          status: plan.status,
        });
        phasePlan = true;
      }
      return { statements: created.length, phasePlan };
    },
  };
}

export type MethodStatementsService = ReturnType<typeof methodStatementsService>;
