import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTermsRepository } from "./terms-repository.ts";
import type { Estimate, EstimateItem, PackSection, PaymentScheduleItem, Proposal } from "./types.ts";

// What the public link returns. The client reads the scope narrative, the
// price at the detail level the contractor chose, the money terms and the
// pack prose. Drawings and the programme never leave the workspace.

export interface PublicCompany {
  name: string;
  logo: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  // Supplied by the organisation's compliance documents once WS-5 lands; null until then.
  insuranceReference: string | null;
}

export interface BuyingListLine {
  description: string;
  qty: number;
  unit: string;
  section: string | null;
}

export interface PublicProposalView {
  proposal: Proposal & { jobProfile: string };
  estimate: Estimate & { items: EstimateItem[]; schedule: PaymentScheduleItem[] };
  company: PublicCompany;
  sections: PackSection[];
  buyingList: BuyingListLine[];
  viewCount: number;
}

const CLIENT_SECTIONS: PackSection["kind"][] = ["scope", "exclusions", "assumptions", "provisional_sums", "warranties", "terms"];

function groupItems(items: EstimateItem[]): EstimateItem[] {
  const byGroup = new Map<string, EstimateItem>();
  for (const item of items) {
    const existing = byGroup.get(item.groupLabel);
    if (existing) {
      existing.total += item.total;
    } else {
      byGroup.set(item.groupLabel, { ...item, description: item.groupLabel, qty: 1, unit: "sum", unitRate: item.total });
    }
  }
  return [...byGroup.values()].map((g) => ({ ...g, unitRate: g.total }));
}

export function publicViewService(db: Knex, repo: ProposalsRepository, terms: ProposalTermsRepository) {
  async function company(orgId: string): Promise<PublicCompany> {
    const org = await db("organization")
      .where({ id: orgId })
      .select("name", "logo", "phone", "address", "contact_email", "website")
      .first();
    return {
      name: (org?.name as string | undefined) ?? "Your contractor",
      logo: (org?.logo as string | null | undefined) ?? null,
      phone: (org?.phone as string | null | undefined) ?? null,
      address: (org?.address as string | null | undefined) ?? null,
      email: (org?.contact_email as string | null | undefined) ?? null,
      website: (org?.website as string | null | undefined) ?? null,
      insuranceReference: null,
    };
  }

  // Labour-only jobs hand the client a buying list: every verified measured
  // item across the proposal's take-offs, quantities only.
  async function buyingList(proposalId: string): Promise<BuyingListLine[]> {
    const rows = await db("precon_boq_rows as r")
      .join("precon_bills as b", "b.id", "r.bill_id")
      .join("precon_sessions as s", "s.id", "b.session_id")
      .where("s.proposal_id", proposalId)
      .whereIn("r.row_type", ["item", "provisional_sum"])
      .whereNot("r.status", "rejected")
      .whereNotNull("r.qty")
      .orderBy("b.sort", "asc")
      .orderBy("r.sort", "asc")
      .select("r.description", "r.qty", "r.unit", "r.element_group");
    return rows.map((r) => ({
      description: r.description as string,
      qty: Number(r.qty),
      unit: (r.unit as string | null) ?? "item",
      section: (r.element_group as string | null) ?? null,
    }));
  }

  return {
    async byToken(token: string): Promise<{ view: PublicProposalView; orgId: string; estimateId: string }> {
      const result = await repo.getByShareToken(token);
      if (!result) throw new NotFoundError("Proposal");
      const { proposal: proposalRow, estimate: estimateRow } = result;
      if (estimateRow.share_token_expires_at && new Date(estimateRow.share_token_expires_at) < new Date()) {
        throw new NotFoundError("Proposal");
      }
      const estimate = repo.toEstimate(estimateRow);
      const proposal = repo.toProposal(proposalRow);
      const jobProfile = proposalRow.job_profile ?? "full_contract";
      const [items, schedule, sections, identity, viewCount] = await Promise.all([
        repo.getItems(estimate.id),
        repo.getSchedule(estimate.id),
        terms.listPackSections(proposal.id),
        company(proposalRow.org_id),
        terms.countEvents(proposal.id, "client_viewed"),
      ]);
      const list = jobProfile === "labour_only" ? await buyingList(proposal.id) : [];
      return {
        orgId: proposalRow.org_id,
        estimateId: estimate.id,
        view: {
          proposal: { ...proposal, jobProfile },
          estimate: {
            ...estimate,
            items: estimate.clientVisibleDetail === "groups" ? groupItems(items) : items,
            schedule,
          },
          company: identity,
          sections: sections.filter((s) => CLIENT_SECTIONS.includes(s.kind)),
          buyingList: list,
          viewCount,
        },
      };
    },
  };
}
