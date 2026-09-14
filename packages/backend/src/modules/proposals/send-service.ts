import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { Knex } from "knex";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { generateId } from "../../lib/ids.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTermsRepository } from "./terms-repository.ts";
import type { ProposalTermsService } from "./terms-service.ts";
import { renderProposalSnapshot } from "./snapshot-pdf.ts";

const SHARE_LINK_DAYS = 30;

export interface SendResult {
  token: string;
  expiresAt: string;
  snapshotFileId: string;
  pdfHash: string;
}

interface CompanyIdentity {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

// Sending is the moment the offer becomes evidence: the schedule is checked,
// the revision is locked, the client-facing document is rendered once to PDF,
// stored, and hashed. Everything after this reads the snapshot, never re-renders.
export function proposalSendService(
  db: Knex,
  repo: ProposalsRepository,
  terms: ProposalTermsRepository,
  termsService: ProposalTermsService,
) {
  async function companyIdentity(orgId: string): Promise<CompanyIdentity> {
    const org = await db("organization").where({ id: orgId }).select("name", "address", "phone", "contact_email").first();
    return {
      name: (org?.name as string | undefined) ?? "Your contractor",
      address: (org?.address as string | null | undefined) ?? null,
      phone: (org?.phone as string | null | undefined) ?? null,
      email: (org?.contact_email as string | null | undefined) ?? null,
    };
  }

  async function storeSnapshot(ownerId: string, fileName: string, pdf: Buffer): Promise<string> {
    const stored = await saveStream(ownerId, Readable.from(pdf));
    const id = generateId("file");
    await db("uploaded_files").insert({
      id,
      owner_id: ownerId,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: stored.sizeBytes,
      storage_path: stored.storagePath,
    });
    return id;
  }

  return {
    async send(proposalId: string, estimateId: string, orgId: string, userId: string): Promise<SendResult> {
      const proposalRow = await repo.getById(proposalId, orgId);
      if (!proposalRow) throw new NotFoundError("Proposal");
      const estimate = await repo.getEstimate(estimateId);
      if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
      if (estimate.status !== "Draft") throw new ForbiddenError("Only Draft estimates can be sent.");

      const schedule = await termsService.assertSendable(estimate);
      const [items, sections, company] = await Promise.all([
        repo.getItems(estimateId),
        terms.listPackSections(proposalId),
        companyIdentity(orgId),
      ]);
      const proposal = repo.toProposal(proposalRow);

      const pdf = await renderProposalSnapshot({ proposal, estimate, items, schedule, sections, company });
      const pdfHash = createHash("sha256").update(pdf).digest("hex");
      const snapshotFileId = await storeSnapshot(
        userId,
        `${proposal.numberLabel}-${estimate.revisionLabel.replace(/\s+/g, "")}.pdf`,
        pdf,
      );

      const token = randomBytes(32).toString("hex");
      const expiresAt = proposal.validUntil
        ? new Date(proposal.validUntil).toISOString()
        : new Date(Date.now() + SHARE_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await repo.setShareToken(estimateId, token, expiresAt);
      await terms.setSnapshot(estimateId, snapshotFileId, pdfHash);
      await repo.updateEstimateMeta(estimateId, { status: "Sent", sentAt: now });
      await repo.updateProposal(proposalId, orgId, { status: "Sent" });
      await repo.logEvent(proposalId, "estimate_sent", userId, {
        estimateId,
        revisionNo: estimate.revisionNo,
        snapshotFileId,
        pdfHash,
      });

      return { token, expiresAt, snapshotFileId, pdfHash };
    },
  };
}
