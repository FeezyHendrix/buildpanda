import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { EstimateItem, ProposalRow } from "./types.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { sendEmail } from "../../lib/mail.ts";
import { projectInviteEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";

const DEFAULT_PHASES = [
  { name: "Site Survey & Soil Testing", date_range: "Weeks 1 – 2" },
  { name: "Permitting & Approvals", date_range: "Weeks 3 – 8" },
  { name: "Foundation & Substructure", date_range: "Weeks 9 – 16" },
  { name: "Superstructure & MEP", date_range: "Weeks 17 – 32" },
  { name: "Finishing", date_range: "Weeks 33 – 42" },
  { name: "External Works", date_range: "Weeks 43 – 46" },
  { name: "Testing & Handover", date_range: "Weeks 47 – 48" },
] as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Estimate sections → budget categories: each distinct estimate group
 * (in first-appearance order) becomes a planned budget category whose amount
 * is the sum of its line-item totals. Contingency, when set, becomes its own
 * category so the planned budget matches the estimate's pre-tax subtotal.
 */
function buildBudgetCategories(
  projectId: string,
  items: EstimateItem[],
  contingencyPct: number,
): Array<Record<string, unknown>> {
  const byGroup = new Map<string, number>();
  for (const item of items) {
    byGroup.set(item.groupLabel, (byGroup.get(item.groupLabel) ?? 0) + item.total);
  }
  const categories = [...byGroup.entries()].map(([name, planned], idx) => ({
    id: generateId("budgetcat"),
    project_id: projectId,
    name,
    cost_code: null,
    planned: round2(planned),
    committed: 0,
    actual: 0,
    notes: "Seeded from the accepted estimate.",
    sort_order: idx,
  }));
  if (contingencyPct > 0 && items.length > 0) {
    const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
    categories.push({
      id: generateId("budgetcat"),
      project_id: projectId,
      name: "Contingency",
      cost_code: null,
      planned: round2((itemsSubtotal * contingencyPct) / 100),
      committed: 0,
      actual: 0,
      notes: `Estimate contingency (${contingencyPct}%).`,
      sort_order: categories.length,
    });
  }
  return categories;
}

export interface ConvertResult {
  projectId: string;
  created: boolean;
  clientInvited: boolean;
}

/**
 * Converts an Accepted proposal into a construction project in one
 * transaction: project + finances, seeded stages, budget categories from the
 * estimate, milestone payments from the payment schedule, a proposal snapshot
 * document, and a client participant invite when the proposal has an email.
 * Idempotent — a proposal already holding a project_id returns it untouched.
 */
export async function convertProposalToProject(
  deps: { db: Knex; repo: ProposalsRepository; log: FastifyBaseLogger },
  args: { proposalId: string; orgId: string; user: { id: string; name: string; email: string } },
): Promise<ConvertResult> {
  const { db, repo, log } = deps;
  const { proposalId, orgId, user } = args;

  const proposalRow: ProposalRow | null = await repo.getById(proposalId, orgId);
  if (!proposalRow) throw new NotFoundError("Proposal");
  if (proposalRow.project_id) {
    // Already converted — return the existing project id
    return { projectId: proposalRow.project_id, created: false, clientInvited: false };
  }
  if (proposalRow.status !== "Accepted") {
    throw new BadRequestError("Only Accepted proposals can be converted.");
  }

  const estimate = await repo.getActiveEstimate(proposalId);
  const [schedule, items] = estimate
    ? await Promise.all([repo.getSchedule(estimate.id), repo.getItems(estimate.id)])
    : [[], []];

  // projects.currency only accepts NGN | USD
  const currency: CurrencyCode = proposalRow.currency === "USD" ? "USD" : "NGN";

  const projectId = generateId("prj");
  const buildingId = generateId("bld");
  const now = new Date().toISOString();

  // The proposal has no programme entity, so stages seed from the standard
  // residential phase set; PMs adjust dates on the schedule page afterwards.
  const clientEmail = proposalRow.client_email?.trim().toLowerCase() || null;
  const inviteToken = clientEmail ? generateId("pinv") : null;

  await db.transaction(async (trx) => {
    await trx("projects").insert({
      id: projectId,
      owner_id: user.id,
      organization_id: orgId,
      name: proposalRow.title,
      address: proposalRow.location ?? "To be confirmed",
      status: "On Track",
      health_score: 0,
      risk: "Low",
      progress_percent: 0,
      budget_total: estimate?.total ?? 0,
      budget_used: 0,
      currency,
      pending_approvals: 0,
      folder_tone: "orange",
      budget_min: estimate?.total ?? 0,
      budget_max: estimate?.total ?? 0,
      setup: {
        projectType: "Residential",
        location: { state: "", city: proposalRow.location ?? "", ownsLand: false },
        buildingType: "House",
        timeline: "12 months",
        fundingMethod: "Self",
        involvementLevel: "Hands-on",
        riskOptions: [],
      },
      });

      await trx("buildings").insert([
        {
          id: buildingId,
          project_id: projectId,
          name: proposalRow.title,
          kind: "real",
          status: "active",
          sort_order: 0,
          progress_percent: 0,
        },
        {
          id: `bld_shared_${projectId}`,
          project_id: projectId,
          name: "Shared",
          kind: "shared",
          status: "active",
          sort_order: -1,
          progress_percent: 0,
        },
      ]);

      await trx("project_phases").insert(
        DEFAULT_PHASES.map((phase, idx) => ({
          id: generateId("phase"),
          project_id: projectId,
          building_id: buildingId,
        name: phase.name,
        status: "Pending",
        date_range: phase.date_range,
        sort_order: idx,
      })),
    );

    await trx("project_finances").insert({
      project_id: projectId,
      currency,
      total_budget: estimate?.total ?? 0,
      funds_deposited: 0,
      funds_released: 0,
      locked_in_escrow: 0,
      remaining_balance: estimate?.total ?? 0,
    });

    const budgetCategories = estimate
      ? buildBudgetCategories(projectId, items, estimate.contingencyPct)
      : [];
    if (budgetCategories.length > 0) {
      await trx("project_budget_categories").insert(budgetCategories);
    }

    if (schedule.length > 0 && estimate) {
      await trx("milestone_payments").insert(
        schedule.map((s, idx) => ({
          id: generateId("mlst"),
          project_id: projectId,
          building_id: `bld_shared_${projectId}`,
          name: s.label,
          phase: "General",
          status: "Pending",
          percent_complete: 0,
          amount: round2((estimate.total * s.percent) / 100),
          proof_file_name: null,
          proof_verified: false,
          inspector_sign_off: "Pending",
          sort_order: idx,
        })),
      );
    }

    await trx("project_documents").insert({
      id: generateId("doc"),
      project_id: projectId,
      category_id: "cat_proposal",
      file_id: null,
      file_name: `Proposal BP-${String(proposalRow.number).padStart(4, "0")} — snapshot`,
      size: "—",
      size_bytes: null,
      status: "Verified",
      uploaded_at: now,
    });

    if (clientEmail && inviteToken) {
      await trx("project_participants").insert({
        id: generateId("pp"),
        project_id: projectId,
        user_id: null,
        email: clientEmail,
        name: proposalRow.client_name,
        role: "client",
        status: "invited",
        invited_by_id: user.id,
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        permissions: JSON.stringify({}),
      });
    }

    await trx("proposals")
      .where({ id: proposalId })
      .update({ project_id: projectId, status: "Converted", updated_at: now });

    await trx("proposal_events").insert({
      id: generateId("evt"),
      proposal_id: proposalId,
      type: "converted",
      actor: user.id,
      metadata: { projectId, clientInvited: Boolean(clientEmail) },
      created_at: now,
    });
  });

  if (clientEmail && inviteToken) {
    const { subject, html } = projectInviteEmail({
      inviterName: user.name,
      projectName: proposalRow.title,
      url: `${config.mail.appUrl}/accept-project-invite/${inviteToken}`,
    });
    void sendEmail({
      to: clientEmail,
      toName: proposalRow.client_name || clientEmail,
      subject,
      html,
    }).catch((err) => log.warn({ err, projectId }, "Failed to send client invite email after conversion"));
  }

  return { projectId, created: true, clientInvited: Boolean(clientEmail) };
}
