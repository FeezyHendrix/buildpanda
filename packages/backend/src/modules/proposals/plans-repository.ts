import type { Knex } from "knex";
import type { PlanDiscipline, ProposalPlan, ProposalPlanRow, UpdateProposalPlanInput } from "./types.ts";

// Drawings on a proposal, with revision control. A drawing revision is never
// deleted by a newer one: the current revision is marked superseded and the
// pair is linked, so take-offs measured on the old revision stay attributed.
export function plansRepository(db: Knex) {
  async function listPlans(proposalId: string): Promise<ProposalPlan[]> {
    const rows = await db<ProposalPlanRow>("proposal_plans as pp")
      .where("pp.proposal_id", proposalId)
      .leftJoin("uploaded_files as f", "f.id", "pp.file_id")
      .orderBy("pp.sort", "asc")
      .orderBy("pp.uploaded_at", "asc")
      .select(
        "pp.id",
        "pp.proposal_id",
        "pp.file_id",
        "pp.label",
        "pp.sheet_code",
        "pp.discipline",
        "pp.revision",
        "pp.revision_status",
        "pp.supersedes_plan_id",
        "pp.uploaded_by",
        "pp.uploaded_at",
        "pp.sort",
        "f.file_name as file_name",
        "f.size_bytes as size_bytes",
        "f.mime_type as mime_type",
      );
    return rows.map((r) => {
      const joined = r as unknown as ProposalPlanRow & {
        file_name: string | null;
        size_bytes: string | number | null;
        mime_type: string | null;
      };
      return {
        id: joined.id,
        proposalId: joined.proposal_id,
        fileId: joined.file_id,
        fileName: joined.file_name ?? "(missing file)",
        sizeBytes: Number(joined.size_bytes ?? 0),
        mimeType: joined.mime_type ?? "application/octet-stream",
        label: joined.label,
        sheetCode: joined.sheet_code ?? null,
        discipline: joined.discipline ?? null,
        revision: joined.revision ?? null,
        revisionStatus: joined.revision_status ?? "current",
        supersedesPlanId: joined.supersedes_plan_id ?? null,
        uploadedBy: joined.uploaded_by,
        uploadedAt: joined.uploaded_at,
        sort: joined.sort,
      };
    });
  }

  // The current revision of a sheet is the one a new upload with the same
  // sheet code supersedes. Never deleted: take-offs measured on it stay valid.
  async function findCurrentPlanBySheetCode(proposalId: string, sheetCode: string): Promise<ProposalPlanRow | null> {
    const row = await db<ProposalPlanRow>("proposal_plans")
      .where({ proposal_id: proposalId, sheet_code: sheetCode, revision_status: "current" })
      .orderBy("uploaded_at", "desc")
      .first();
    return row ?? null;
  }

  async function supersedePlan(planId: string, byPlanId: string): Promise<void> {
    await db<ProposalPlanRow>("proposal_plans").where({ id: planId }).update({ revision_status: "superseded" });
    await db<ProposalPlanRow>("proposal_plans").where({ id: byPlanId }).update({ supersedes_plan_id: planId });
  }

  async function updatePlan(planId: string, proposalId: string, patch: UpdateProposalPlanInput): Promise<number> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.label !== undefined) dbPatch["label"] = patch.label;
    if (patch.sheetCode !== undefined) dbPatch["sheet_code"] = patch.sheetCode;
    if (patch.discipline !== undefined) dbPatch["discipline"] = patch.discipline;
    if (patch.revision !== undefined) dbPatch["revision"] = patch.revision;
    if (Object.keys(dbPatch).length === 0) return 0;
    return db("proposal_plans").where({ id: planId, proposal_id: proposalId }).update(dbPatch);
  }

  async function insertPlan(data: {
    id: string;
    proposalId: string;
    fileId: string;
    label: string | null;
    sheetCode: string | null;
    discipline: PlanDiscipline | null;
    revision: string | null;
    uploadedBy: string;
    sort: number;
  }): Promise<void> {
    await db<ProposalPlanRow>("proposal_plans").insert({
      id: data.id,
      proposal_id: data.proposalId,
      file_id: data.fileId,
      label: data.label,
      sheet_code: data.sheetCode,
      discipline: data.discipline,
      revision: data.revision,
      revision_status: "current",
      supersedes_plan_id: null,
      uploaded_by: data.uploadedBy,
      sort: data.sort,
    });
  }

  async function deletePlan(planId: string, proposalId: string): Promise<number> {
    return db("proposal_plans")
      .where({ id: planId, proposal_id: proposalId })
      .delete();
  }

  return { listPlans, insertPlan, findCurrentPlanBySheetCode, supersedePlan, updatePlan, deletePlan };
}

export type PlansRepository = ReturnType<typeof plansRepository>;
