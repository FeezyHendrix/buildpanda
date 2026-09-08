import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ConvertInclude, ConvertPreview, ConvertPreviewSection, ConvertSection, ProposalRow } from "./types.ts";
import { CONVERT_SECTIONS } from "./types.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { sendEmail } from "../../lib/mail.ts";
import { projectInviteEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { loadConvertSources, type ConvertSources } from "./convert-sources.ts";
import {
  areasToSelections,
  buildBudgetCategories,
  formatBytes,
  plansToDocuments,
  programmeToSeed,
  programmeWeeks,
  rowsToMaterialOrders,
  scheduleToMilestones,
  setupFromStructure,
} from "./convert-mappers.ts";

export interface ConvertResult {
  projectId: string;
  created: boolean;
  clientInvited: boolean;
}

const ALL_INCLUDED: Required<ConvertInclude> = Object.fromEntries(
  CONVERT_SECTIONS.map((key) => [key, true]),
) as Required<ConvertInclude>;

/** Everything conversion would write, built once from the loaded sources. */
function buildSeeds(
  sources: ConvertSources,
  ids: { projectId: string; buildingId: string; sharedBuildingId: string; ownerId: string; currency: string; now: string },
) {
  const startDate = sources.programme?.startDate ?? ids.now;
  const tasksById = new Map((sources.programme?.tasks ?? []).map((t) => [t.id, t]));
  const programme =
    sources.programme && sources.programme.tasks.length > 0
      ? programmeToSeed(sources.programme, { projectId: ids.projectId, buildingId: ids.buildingId, ownerId: ids.ownerId })
      : null;
  const phaseByTaskId = new Map(
    (programme?.phases ?? []).map((p) => [p.programme_task_id, { id: p.id, name: p.name, building_id: p.building_id }]),
  );
  const estimateTotal = sources.estimate?.total ?? 0;
  const milestones = sources.estimate
    ? scheduleToMilestones(sources.schedule, estimateTotal, {
        projectId: ids.projectId,
        sharedBuildingId: ids.sharedBuildingId,
        phaseByTaskId,
        tasksById,
      })
    : [];
  const budget = sources.estimate ? buildBudgetCategories(ids.projectId, sources.items, sources.estimate.contingencyPct) : [];
  const materials = rowsToMaterialOrders(sources.rows, {
    projectId: ids.projectId,
    currency: ids.currency,
    startDate,
    sessionTitle: sources.session?.title ?? "take-off",
    jobProfile: sources.jobProfile,
    activities: programme?.activities ?? [],
    tasksById,
    leadTimeByName: sources.leadTimeByName,
  });
  const drawings = plansToDocuments(sources.plans, { projectId: ids.projectId, uploadedBy: ids.ownerId, now: ids.now });
  const selections = areasToSelections(sources.rows, { projectId: ids.projectId, currency: ids.currency, createdBy: ids.ownerId });
  const weeks = sources.programme ? programmeWeeks(sources.programme.startDate, sources.programme.finishDate) : null;
  const setup = setupFromStructure(sources.session?.structureContext ?? null, sources.proposal.location, weeks);
  return { programme, milestones, budget, materials, drawings, selections, setup, startDate };
}

function previewSections(sources: ConvertSources, seeds: ReturnType<typeof buildSeeds>): ConvertPreviewSection[] {
  const p = seeds.programme;
  const unverified = (sources.programme?.tasks ?? []).filter((t) => t.status !== "verified" && t.status !== "rejected").length;
  const rows: Array<[ConvertSection, string, number, string, boolean]> = [
    [
      "programme",
      "Stages, activities and key dates",
      p ? p.phases.length + p.activities.length + p.keyDates.length : 0,
      p
        ? `${p.phases.length} stages · ${p.activities.length} activities · ${p.keyDates.length} key dates${unverified > 0 ? ` · ${unverified} tasks not yet verified` : ""}`
        : "No programme on the take-off: one placeholder stage will be created",
      p !== null,
    ],
    [
      "milestones",
      "Payment milestones",
      seeds.milestones.length,
      seeds.milestones.length > 0
        ? `${seeds.milestones.length} from the payment schedule · advance claimable on day one`
        : "No payment schedule on the estimate",
      seeds.milestones.length > 0,
    ],
    ["budget", "Budget categories", seeds.budget.length, seeds.budget.length > 0 ? "From estimate groups plus contingency" : "No estimate items", seeds.budget.length > 0],
    [
      "materials",
      "Material orders (draft)",
      seeds.materials.orders.length,
      seeds.materials.orders.length > 0
        ? `${seeds.materials.orders.length} from take-off lines · ${seeds.materials.longLeadCount} long-lead · owned by ${sources.jobProfile === "labour_only" ? "client" : "contractor"}`
        : "No measured lines to seed",
      seeds.materials.orders.length > 0,
    ],
    ["drawings", "Drawings with revisions", seeds.drawings.documents.length, seeds.drawings.documents.length > 0 ? "Current revisions filed under Plans" : "No drawings uploaded", seeds.drawings.documents.length > 0],
    ["documents", "Proposal snapshot", 1, sources.snapshotFileId ? "Sent proposal PDF and acceptance record" : "Placeholder row until a snapshot PDF exists", true],
    ["permits", "Permits", 0, "Permit checklist on proposals is not available yet", false],
    ["selections", "Finishes selections", seeds.selections.length, seeds.selections.length > 0 ? "One per measured space" : "No measured-areas take-off", seeds.selections.length > 0],
    ["client", "Client participant", sources.proposal.client_email ? 1 : 0, sources.proposal.client_email ? `Invite ${sources.proposal.client_name}` : "No client email on the proposal", Boolean(sources.proposal.client_email)],
  ];
  return rows.map(([key, label, count, detail, available]) => ({ key, label, count, detail, available }));
}

async function loadProposal(repo: ProposalsRepository, proposalId: string, orgId: string): Promise<ProposalRow> {
  const row = await repo.getById(proposalId, orgId);
  if (!row) throw new NotFoundError("Proposal");
  return row;
}

export async function previewConversion(
  deps: { db: Knex; repo: ProposalsRepository },
  args: { proposalId: string; orgId: string; userId: string },
): Promise<ConvertPreview> {
  const proposal = await loadProposal(deps.repo, args.proposalId, args.orgId);
  const sources = await loadConvertSources(deps.db, deps.repo, proposal, args.orgId);
  const now = new Date().toISOString();
  const seeds = buildSeeds(sources, {
    projectId: "preview",
    buildingId: "preview",
    sharedBuildingId: "preview",
    ownerId: args.userId,
    currency: proposal.currency,
    now,
  });
  const warnings: string[] = [];
  if (proposal.status !== "Accepted" && !proposal.project_id) warnings.push("Only an accepted proposal can be converted.");
  if (!sources.estimate) warnings.push("The proposal has no estimate; contract sum will be zero.");
  if (!sources.session) warnings.push("No take-off is linked to this proposal; stages and materials cannot be derived.");
  if (seeds.programme === null && sources.session) warnings.push("The take-off has no programme; a single placeholder stage will be created.");
  if (sources.schedule.length === 0) warnings.push("No payment schedule; no milestones will be created.");
  return {
    proposalId: proposal.id,
    alreadyConverted: Boolean(proposal.project_id),
    projectId: proposal.project_id,
    sections: previewSections(sources, seeds),
    setup: {
      projectType: String(seeds.setup["projectType"]),
      buildingType: String(seeds.setup["buildingType"]),
      timeline: String(seeds.setup["timeline"]),
      source: String(seeds.setup["source"]),
    },
    contractSum: sources.estimate?.total ?? 0,
    currency: proposal.currency,
    warnings,
  };
}

/**
 * Converts an Accepted proposal into a construction project in one
 * transaction, seeding every project section from the pre-construction
 * records it came from and stamping each row with its source id.
 * Idempotent — a proposal already holding a project_id returns it untouched.
 */
export async function convertProposalToProject(
  deps: { db: Knex; repo: ProposalsRepository; log: FastifyBaseLogger },
  args: { proposalId: string; orgId: string; user: { id: string; name: string; email: string }; include?: ConvertInclude },
): Promise<ConvertResult> {
  const { db, repo, log } = deps;
  const { proposalId, orgId, user } = args;
  const include: Required<ConvertInclude> = { ...ALL_INCLUDED, ...(args.include ?? {}) };

  const proposal = await loadProposal(repo, proposalId, orgId);
  if (proposal.project_id) return { projectId: proposal.project_id, created: false, clientInvited: false };
  if (proposal.status !== "Accepted") throw new BadRequestError("Only Accepted proposals can be converted.");

  const sources = await loadConvertSources(db, repo, proposal, orgId);
  // projects.currency only accepts NGN | USD
  const currency: CurrencyCode = proposal.currency === "USD" ? "USD" : "NGN";
  const projectId = generateId("prj");
  const buildingId = generateId("bld");
  const sharedBuildingId = `bld_shared_${projectId}`;
  const now = new Date().toISOString();
  const seeds = buildSeeds(sources, { projectId, buildingId, sharedBuildingId, ownerId: user.id, currency, now });
  const total = sources.estimate?.total ?? 0;
  const clientEmail = include.client ? proposal.client_email?.trim().toLowerCase() || null : null;
  const inviteToken = clientEmail ? generateId("pinv") : null;

  await db.transaction(async (trx) => {
    await trx("projects").insert({
      id: projectId,
      owner_id: user.id,
      organization_id: orgId,
      name: proposal.title,
      address: proposal.location ?? "To be confirmed",
      status: "On Track",
      health_score: 0,
      risk: "Low",
      progress_percent: 0,
      budget_total: total,
      budget_used: 0,
      currency,
      pending_approvals: 0,
      folder_tone: "orange",
      budget_min: total,
      budget_max: total,
      setup: seeds.setup,
      estimate_id: sources.estimate?.id ?? null,
    });
    await trx("buildings").insert([
      { id: buildingId, project_id: projectId, name: proposal.title, kind: "real", status: "active", sort_order: 0, progress_percent: 0 },
      { id: sharedBuildingId, project_id: projectId, name: "Shared", kind: "shared", status: "active", sort_order: -1, progress_percent: 0 },
    ]);
    await trx("project_finances").insert({
      project_id: projectId,
      currency,
      total_budget: total,
      amount_paid_to_date: 0,
      contract_sum: total,
      variations_total: 0,
      certified_gross_to_date: 0,
    });

    if (include.programme && seeds.programme) {
      await trx("project_phases").insert(seeds.programme.phases);
      if (seeds.programme.activities.length > 0) await trx("activities").insert(seeds.programme.activities);
      if (seeds.programme.keyDates.length > 0) await trx("key_dates").insert(seeds.programme.keyDates);
    } else {
      // no programme to derive stages from: one honest placeholder, not a fixed list
      await trx("project_phases").insert({
        id: generateId("phase"),
        project_id: projectId,
        building_id: buildingId,
        name: "Construction",
        status: "Pending",
        date_range: null,
        sort_order: 0,
      });
    }

    if (include.budget && seeds.budget.length > 0) await trx("project_budget_categories").insert(seeds.budget);
    if (include.milestones && seeds.milestones.length > 0) await trx("milestone_payments").insert(seeds.milestones);
    if (include.materials && seeds.materials.orders.length > 0) await trx("material_orders").insert(seeds.materials.orders);
    if (include.drawings && seeds.drawings.documents.length > 0) {
      await trx("project_documents").insert(seeds.drawings.documents);
      await trx("document_versions").insert(seeds.drawings.versions);
    }
    if (include.selections && seeds.selections.length > 0) await trx("selections").insert(seeds.selections);

    if (include.documents) {
      const label = `Proposal BP-${String(proposal.number).padStart(4, "0")}`;
      const snapshot = sources.snapshotFileId
        ? await trx("uploaded_files").where({ id: sources.snapshotFileId }).first<{ file_name: string; size_bytes: number | string }>()
        : null;
      await trx("project_documents").insert({
        id: generateId("doc"),
        project_id: projectId,
        category_id: "cat_proposal",
        file_id: snapshot ? sources.snapshotFileId : null,
        file_name: snapshot ? snapshot.file_name : `${label} — snapshot`,
        size: snapshot ? formatBytes(Number(snapshot.size_bytes)) : "—",
        size_bytes: snapshot ? Number(snapshot.size_bytes) : null,
        status: "Verified",
        uploaded_at: now,
      });
    }

    if (clientEmail && inviteToken) {
      await trx("project_participants").insert({
        id: generateId("pp"),
        project_id: projectId,
        user_id: null,
        email: clientEmail,
        name: proposal.client_name,
        role: "client",
        status: "invited",
        invited_by_id: user.id,
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        permissions: JSON.stringify({}),
      });
    }

    await trx("proposals").where({ id: proposalId }).update({ project_id: projectId, status: "Converted", updated_at: now });
    if (sources.session) {
      await trx("precon_sessions").where({ id: sources.session.id }).update({ project_id: projectId, updated_at: now });
    }
    await trx("proposal_events").insert({
      id: generateId("evt"),
      proposal_id: proposalId,
      type: "converted",
      actor: user.id,
      metadata: {
        projectId,
        clientInvited: Boolean(clientEmail),
        include,
        seeded: {
          stages: seeds.programme?.phases.length ?? 1,
          activities: seeds.programme?.activities.length ?? 0,
          milestones: seeds.milestones.length,
          materials: seeds.materials.orders.length,
          drawings: seeds.drawings.documents.length,
          selections: seeds.selections.length,
        },
      },
      created_at: now,
    });
  });

  if (clientEmail && inviteToken) {
    const { subject, html } = projectInviteEmail({
      inviterName: user.name,
      projectName: proposal.title,
      url: `${config.mail.appUrl}/accept-project-invite/${inviteToken}`,
    });
    void sendEmail({ to: clientEmail, toName: proposal.client_name || clientEmail, subject, html }).catch((err) =>
      log.warn({ err, projectId }, "Failed to send client invite email after conversion"),
    );
  }

  return { projectId, created: true, clientInvited: Boolean(clientEmail) };
}
