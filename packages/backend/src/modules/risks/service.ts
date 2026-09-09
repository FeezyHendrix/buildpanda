import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { Knex } from "knex";
import type { RisksRepository, RiskFactorUpdatePatch } from "./repository.ts";
import type {
  CreateRiskInput,
  DraftedRisk,
  EditRiskInput,
  RiskDraftContext,
  RiskEditState,
  RiskFactor,
  RiskFactorRow,
  RiskImpact,
  RiskLikelihood,
} from "./types.ts";
import type { RiskLevel } from "../projects/types.ts";
import type { NotificationsService } from "../notifications/service.ts";
import { riskDraftMessages, riskDraftSchema, toDraftedRisks } from "./risk-draft.ts";
import type { LlmMessage } from "../../lib/llm.ts";
import type { ZodType } from "zod";

export type { CreateRiskInput, EditRiskInput } from "./types.ts";

// The LLM call is injected so the service can be tested with a fake and so the
// register never depends on the transport module at construction time.
export type RiskDrafter = <T>(messages: LlmMessage[], schema: ZodType<T>) => Promise<{ data: T } | null>;

export interface RisksDeps {
  db?: Knex;
  notifications?: NotificationsService;
  draft?: RiskDrafter;
}

const LEVEL_WEIGHT: Record<RiskLikelihood | RiskImpact, number> = { low: 1, medium: 2, high: 3 };

// Likelihood x impact on a 1..9 scale. Severity, which the project side and the
// assistant already read, is derived from the same score so the two never disagree.
export function riskScore(likelihood: RiskLikelihood | null, impact: RiskImpact | null): number | null {
  if (!likelihood || !impact) return null;
  return LEVEL_WEIGHT[likelihood] * LEVEL_WEIGHT[impact];
}

export function severityForScore(score: number | null, fallback: RiskLevel = "Medium"): RiskLevel {
  if (score === null) return fallback;
  if (score >= 6) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function editStateOf(row: RiskFactorRow): RiskEditState {
  if (row.confirmed_at) return "confirmed";
  if (row.origin === "ai" || row.origin === "prompt") {
    return new Date(row.updated_at).getTime() > new Date(row.created_at).getTime() + 1000 ? "edited" : "ai_draft";
  }
  return "edited";
}

const toIso = (value: Date | string | null): string | null => (value ? new Date(value).toISOString() : null);
const toDateOnly = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

export function toRiskFactor(row: RiskFactorRow): RiskFactor {
  return {
    id: row.id,
    projectId: row.project_id,
    proposalId: row.proposal_id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
    severity: row.severity,
    likelihood: row.likelihood,
    impact: row.impact,
    score: riskScore(row.likelihood, row.impact),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    mitigation: row.mitigation,
    status: row.status,
    reviewDate: toDateOnly(row.review_date),
    origin: row.origin,
    editState: editStateOf(row),
    confirmedBy: row.confirmed_by,
    confirmedAt: toIso(row.confirmed_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function notifyHighRisk(deps: RisksDeps, projectId: string, title: string): Promise<void> {
  if (!deps.notifications || !deps.db) return;
  const project = await deps.db("projects")
    .select("owner_id")
    .where({ id: projectId })
    .first<{ owner_id: string | null }>();
  if (!project?.owner_id) return;
  void deps.notifications
    .notify(project.owner_id, "risk_high_added", { title: "A high-severity risk was added", body: title, projectId })
    .catch(() => undefined);
}

function patchFromInput(input: EditRiskInput, existing: RiskFactorRow): RiskFactorUpdatePatch {
  const patch: RiskFactorUpdatePatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
  if (input.likelihood !== undefined) patch.likelihood = input.likelihood;
  if (input.impact !== undefined) patch.impact = input.impact;
  if (input.ownerId !== undefined) patch.owner_id = input.ownerId;
  if (input.ownerName !== undefined) patch.owner_name = input.ownerName;
  if (input.mitigation !== undefined) patch.mitigation = input.mitigation;
  if (input.status !== undefined) patch.status = input.status;
  if (input.reviewDate !== undefined) patch.review_date = input.reviewDate;
  const likelihood = input.likelihood !== undefined ? input.likelihood : existing.likelihood;
  const impact = input.impact !== undefined ? input.impact : existing.impact;
  if (input.severity !== undefined) patch.severity = input.severity;
  else if (input.likelihood !== undefined || input.impact !== undefined) {
    patch.severity = severityForScore(riskScore(likelihood, impact), existing.severity);
  }
  return patch;
}

export function risksService(repository: RisksRepository, deps: RisksDeps = {}) {
  async function requireScoped(riskId: string, scope: { projectId?: string; proposalId?: string }): Promise<RiskFactorRow> {
    const existing = await repository.findById(riskId);
    const matches =
      existing &&
      ((scope.projectId && existing.project_id === scope.projectId) ||
        (scope.proposalId && existing.proposal_id === scope.proposalId));
    if (!existing || !matches) throw new NotFoundError("Risk factor");
    return existing;
  }

  async function create(
    scope: { projectId?: string; proposalId?: string },
    input: CreateRiskInput,
    origin: "ai" | "manual" | "prompt" = "manual",
  ): Promise<RiskFactorRow> {
    const score = riskScore(input.likelihood ?? null, input.impact ?? null);
    return repository.create({
      id: generateId("risk"),
      project_id: scope.projectId ?? null,
      proposal_id: scope.proposalId ?? null,
      title: input.title,
      description: input.description,
      description_html: input.descriptionHtml ?? null,
      severity: input.severity ?? severityForScore(score),
      likelihood: input.likelihood ?? null,
      impact: input.impact ?? null,
      owner_id: input.ownerId ?? null,
      owner_name: input.ownerName ?? null,
      mitigation: input.mitigation ?? null,
      status: input.status ?? "open",
      review_date: input.reviewDate ?? null,
      origin,
    });
  }

  // Any edit after a confirmation reopens the row: the person who confirmed
  // signed off a different text, so the sign-off is cleared, never carried.
  async function edit(existing: RiskFactorRow, input: EditRiskInput): Promise<RiskFactorRow> {
    const patch = patchFromInput(input, existing);
    if (existing.confirmed_at) {
      patch.confirmed_at = null;
      patch.confirmed_by = null;
    }
    const updated = await repository.update(existing.id, patch);
    if (!updated) throw new NotFoundError("Risk factor");
    return updated;
  }

  return {
    // ---- project scope (unchanged public surface) ----
    async listByProject(projectId: string): Promise<RiskFactor[]> {
      return (await repository.listByProject(projectId)).map(toRiskFactor);
    },

    async create(projectId: string, input: CreateRiskInput): Promise<RiskFactor> {
      const row = await create({ projectId }, input);
      if (row.severity === "High") await notifyHighRisk(deps, projectId, input.title);
      return toRiskFactor(row);
    },

    async edit(projectId: string, riskId: string, input: EditRiskInput): Promise<RiskFactor> {
      const existing = await requireScoped(riskId, { projectId });
      const updated = await edit(existing, input);
      if (updated.severity === "High" && existing.severity !== "High") {
        await notifyHighRisk(deps, projectId, updated.title);
      }
      return toRiskFactor(updated);
    },

    async remove(projectId: string, riskId: string): Promise<void> {
      await requireScoped(riskId, { projectId });
      await repository.deleteRiskFactor(riskId);
    },

    // ---- proposal scope ----
    async listByProposal(proposalId: string): Promise<RiskFactor[]> {
      return (await repository.listByProposal(proposalId)).map(toRiskFactor);
    },

    async createForProposal(proposalId: string, input: CreateRiskInput): Promise<RiskFactor> {
      return toRiskFactor(await create({ proposalId }, input));
    },

    async editForProposal(proposalId: string, riskId: string, input: EditRiskInput): Promise<RiskFactor> {
      const existing = await requireScoped(riskId, { proposalId });
      return toRiskFactor(await edit(existing, input));
    },

    async removeForProposal(proposalId: string, riskId: string): Promise<void> {
      await requireScoped(riskId, { proposalId });
      await repository.deleteRiskFactor(riskId);
    },

    async confirm(scope: { projectId?: string; proposalId?: string }, riskId: string, actor: string): Promise<RiskFactor> {
      await requireScoped(riskId, scope);
      const updated = await repository.update(riskId, { confirmed_by: actor, confirmed_at: new Date() });
      if (!updated) throw new NotFoundError("Risk factor");
      return toRiskFactor(updated);
    },

    // Panda AI drafts, the register keeps every row editable. Existing rows are
    // left alone; a redraft adds to the register rather than replacing what a
    // person may already have edited.
    async draftForProposal(proposalId: string, ctx: RiskDraftContext): Promise<RiskFactor[]> {
      if (!deps.draft) throw new BadRequestError("Panda AI drafting is not configured");
      const response = await deps.draft(riskDraftMessages(ctx), riskDraftSchema);
      if (!response) throw new BadRequestError("Panda AI returned no risks; try again");
      const drafted: DraftedRisk[] = toDraftedRisks(response.data);
      const rows = await repository.createMany(
        drafted.map((risk) => ({
          id: generateId("risk"),
          project_id: null,
          proposal_id: proposalId,
          title: risk.title,
          description: risk.description,
          description_html: null,
          severity: severityForScore(riskScore(risk.likelihood, risk.impact)),
          likelihood: risk.likelihood,
          impact: risk.impact,
          owner_id: null,
          owner_name: null,
          mitigation: risk.mitigation,
          status: "open" as const,
          review_date: null,
          origin: "ai" as const,
        })),
      );
      return rows.map(toRiskFactor);
    },

    // Handoff: the confirmed register travels to the project as-is, with the
    // proposal row kept so the offer's record stays intact. Unconfirmed rows
    // are carried too when nothing was confirmed, so the project never opens
    // with an empty register the proposal already had.
    async carryToProject(proposalId: string, projectId: string): Promise<number> {
      const rows = await repository.listByProposal(proposalId);
      const confirmed = rows.filter((r) => r.confirmed_at);
      const source = confirmed.length > 0 ? confirmed : rows;
      const created = await repository.createMany(
        source.map((r) => ({
          id: generateId("risk"),
          project_id: projectId,
          proposal_id: null,
          title: r.title,
          description: r.description,
          description_html: r.description_html,
          severity: r.severity,
          likelihood: r.likelihood,
          impact: r.impact,
          owner_id: r.owner_id,
          owner_name: r.owner_name,
          mitigation: r.mitigation,
          status: r.status,
          review_date: toDateOnly(r.review_date),
          origin: r.origin,
        })),
      );
      return created.length;
    },
  };
}

export type RisksService = ReturnType<typeof risksService>;
