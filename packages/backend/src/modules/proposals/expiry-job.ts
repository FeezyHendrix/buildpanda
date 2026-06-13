import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { proposalsRepository } from "./repository.ts";
import { sendEmail } from "../../lib/mail.ts";
import {
  proposalExpiryNudgeEmail,
  proposalExpiredEmail,
} from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { generateId } from "../../lib/ids.ts";

export const PROPOSAL_EXPIRY_QUEUE = "proposal-expiry-sweep";

// Run hourly
const INTERVAL_MS = 60 * 60 * 1_000;

// Nudge when ≤ 2 days remain
const NUDGE_DAYS = 2;

export interface ExpiryJobData {
  _tick: number;
}

export async function runExpirySweep(db: Knex): Promise<void> {
  const repo = proposalsRepository(db);
  const now = new Date().toISOString();

  // 1. Expire overdue estimates/proposals
  const expired = await repo.expireOverdueEstimates(now);
  if (expired.length > 0) {
    // Fetch proposal details to send expiry notification emails
    for (const { proposalId } of expired) {
      const proposal = await db("proposals as p")
        .join("organization as o", "o.id", "p.org_id")
        .where("p.id", proposalId)
        .select("p.*", "o.contact_email as org_email")
        .first();

      if (!proposal) continue;

      const notifyEmail: string | null = (proposal.org_email as string | null) ?? null;
      if (notifyEmail) {
        const workspaceUrl = `${config.mail.appUrl}/sales/proposals/${proposal.id as string}`;
        const tpl = proposalExpiredEmail({
          proposalTitle: proposal.title as string,
          proposalNumber: `BP-${String(proposal.number as number).padStart(4, "0")}`,
          clientName: proposal.client_name as string,
          workspaceUrl,
        });
        void sendEmail({ to: notifyEmail, ...tpl }).catch(() => {
          // Non-fatal — email failure shouldn't stop the sweep
        });
      }
    }
  }

  // 2. Send nudge emails for proposals expiring within NUDGE_DAYS
  const expiringSoon = await repo.getProposalsExpiringWithinDays(NUDGE_DAYS, now);
  for (const { proposal, orgEmail, orgName } of expiringSoon) {
    if (!orgEmail) continue;

    const workspaceUrl = `${config.mail.appUrl}/sales/proposals/${proposal.id}`;
    const tpl = proposalExpiryNudgeEmail({
      companyEmail: orgEmail,
      proposalTitle: proposal.title,
      proposalNumber: `BP-${String(proposal.number).padStart(4, "0")}`,
      clientName: proposal.client_name,
      validUntil: new Date(proposal.valid_until!).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      workspaceUrl,
    });
    void sendEmail({ to: orgEmail, toName: orgName, ...tpl }).catch(() => {});

    // Log so we don't nudge again
    void db("proposal_events").insert({
      id: generateId("evt"),
      proposal_id: proposal.id,
      type: "expiry_nudge_sent",
      actor: null,
      metadata: null,
    }).catch(() => {});
  }
}

export function registerProposalExpiryWorker(db: Knex, manager: QueueManager): void {
  manager.startRepeating<ExpiryJobData>(
    PROPOSAL_EXPIRY_QUEUE,
    INTERVAL_MS,
    () => runExpirySweep(db),
    { _tick: 0 },
  );
}
