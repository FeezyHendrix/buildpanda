import { z } from "zod";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { chatJsonValidated, isLlmConfigured } from "../../lib/llm.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTermsRepository } from "./terms-repository.ts";
import { PACK_SECTION_KINDS, type PackSection, type PackSectionKind, type UpsertPackSectionInput } from "./types.ts";

const SECTION_ORDER: Record<PackSectionKind, number> = {
  scope: 0,
  exclusions: 1,
  assumptions: 2,
  provisional_sums: 3,
  warranties: 4,
  terms: 5,
  site_survey: 6,
};

// What Panda AI is allowed to draft. Terms and warranties are the contractor's
// own words and never come from the model.
const DRAFTABLE = ["scope", "exclusions", "assumptions", "provisional_sums"] as const;
type DraftableKind = (typeof DRAFTABLE)[number];
const isDraftable = (kind: PackSectionKind): kind is DraftableKind => (DRAFTABLE as readonly string[]).includes(kind);

const draftSchema = z.object({
  scope: z.string().min(1),
  exclusions: z.array(z.string().min(1)).max(20),
  assumptions: z.array(z.string().min(1)).max(20),
  provisional_sums: z.array(z.string().min(1)).max(20),
});

export interface PackDraftContext {
  title: string;
  clientName: string;
  location: string | null;
  brief: string | null;
  jobProfile: string;
  structure: string | null;
  billSummary: string[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function listHtml(lines: string[]): string {
  return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

export function packService(repo: ProposalsRepository, terms: ProposalTermsRepository) {
  async function assertProposal(proposalId: string, orgId: string) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
    return proposal;
  }

  return {
    async list(proposalId: string, orgId: string): Promise<PackSection[]> {
      await assertProposal(proposalId, orgId);
      return terms.listPackSections(proposalId);
    },

    async upsert(proposalId: string, orgId: string, userId: string, input: UpsertPackSectionInput): Promise<PackSection> {
      await assertProposal(proposalId, orgId);
      if (!PACK_SECTION_KINDS.includes(input.kind)) throw new BadRequestError("Unknown pack section");
      const estimate = await repo.getActiveEstimate(proposalId);
      return terms.upsertPackSection({
        id: generateId("pack"),
        proposalId,
        estimateId: estimate?.id ?? null,
        kind: input.kind,
        bodyHtml: input.bodyHtml,
        sort: SECTION_ORDER[input.kind],
        // a human edit always wins the origin, even over an AI draft it replaces
        origin: input.origin ?? "manual",
        updatedBy: userId,
      });
    },

    async remove(proposalId: string, orgId: string, kind: PackSectionKind): Promise<{ ok: true }> {
      await assertProposal(proposalId, orgId);
      await terms.deletePackSection(proposalId, kind);
      return { ok: true };
    },

    // Drafts scope, exclusions, assumptions and provisional sums from what the
    // proposal already knows. Existing manually edited sections are never
    // overwritten; the caller passes `kinds` to say which to (re)draft.
    async draft(
      proposalId: string,
      orgId: string,
      userId: string,
      context: PackDraftContext,
      kinds: PackSectionKind[] = [...DRAFTABLE],
    ): Promise<PackSection[]> {
      await assertProposal(proposalId, orgId);
      if (!isLlmConfigured()) throw new BadRequestError("Panda AI is not configured on this server.");
      const wanted = kinds.filter(isDraftable);
      if (wanted.length === 0) throw new BadRequestError("Nothing to draft: pick scope, exclusions, assumptions or provisional sums.");

      const result = await chatJsonValidated(
        [
          {
            role: "system",
            content:
              "You draft the prose sections of a building contractor's proposal for a Nigerian residential or small commercial job. " +
              "Write plainly for a client, not a quantity surveyor. Scope is two to four short paragraphs. Exclusions, assumptions and provisional sums are short bullet lines. " +
              "Never invent prices. Never mention money the scope does not already contain. Respond with JSON only: " +
              '{"scope":"...","exclusions":["..."],"assumptions":["..."],"provisional_sums":["..."]}',
          },
          {
            role: "user",
            content: [
              `Proposal: ${context.title} for ${context.clientName}${context.location ? ` at ${context.location}` : ""}.`,
              `Job profile: ${context.jobProfile.replace(/_/g, " ")}.`,
              context.brief ? `Client brief: ${context.brief}` : "No client brief given.",
              context.structure ? `Structure as read from the drawings: ${context.structure}.` : "No drawings measured yet.",
              context.billSummary.length > 0 ? `Bill sections measured: ${context.billSummary.join("; ")}.` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        draftSchema,
      );
      if (!result) throw new BadRequestError("Panda AI returned nothing. Try again.");

      const estimate = await repo.getActiveEstimate(proposalId);
      const bodies: Record<DraftableKind, string> = {
        scope: result.data.scope
          .split(/\n{2,}/)
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join(""),
        exclusions: listHtml(result.data.exclusions),
        assumptions: listHtml(result.data.assumptions),
        provisional_sums: listHtml(result.data.provisional_sums),
      };
      const saved: PackSection[] = [];
      for (const kind of wanted) {
        saved.push(
          await terms.upsertPackSection({
            id: generateId("pack"),
            proposalId,
            estimateId: estimate?.id ?? null,
            kind,
            bodyHtml: bodies[kind],
            sort: SECTION_ORDER[kind],
            origin: "ai",
            updatedBy: userId,
          }),
        );
      }
      return saved;
    },
  };
}

export type PackService = ReturnType<typeof packService>;
