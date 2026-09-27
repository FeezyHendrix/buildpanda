import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { complianceDocsRepository } from "./repository.ts";
import { COMPLIANCE_EXPIRING_WINDOW_DAYS } from "./types.ts";

export const COMPLIANCE_EXPIRY_QUEUE = "compliance-doc-expiry-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;

export interface ComplianceExpiryJobData {
  _tick: number;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  insurance_car: "Contractor's all-risk insurance",
  insurance_public_liability: "Public liability insurance",
  performance_bond: "Performance bond",
  advance_payment_guarantee: "Advance payment guarantee",
  tax_clearance: "Tax clearance certificate",
  cac: "CAC registration",
  other: "Compliance document",
};

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Same shape as the permits sweep: once a day, tell the organisation's owners
// and admins about certificates crossing the 30-day window or lapsing, and
// stamp the row so nobody is told twice.
export async function runComplianceExpirySweep(db: Knex, queue?: QueueManager): Promise<void> {
  const repo = complianceDocsRepository(db);
  const notifications = notificationsService(notificationsRepository(db), queue);
  const today = new Date().toISOString().slice(0, 10);
  const horizon = isoDateOffset(COMPLIANCE_EXPIRING_WINDOW_DAYS);

  for (const doc of await repo.expiringBetween(today, horizon)) {
    const label = DOC_TYPE_LABEL[doc.doc_type] ?? DOC_TYPE_LABEL["other"]!;
    for (const userId of await repo.orgAdminUserIds(doc.org_id)) {
      await notifications.notify(userId, "compliance_doc_expiring", {
        title: `${label} expires soon`,
        body: `${doc.file_name}${doc.reference ? ` (${doc.reference})` : ""} expires on ${String(doc.expiry_date).slice(0, 10)}.`,
        ctaUrl: "/sales/settings/compliance-docs",
      });
    }
    await repo.update(doc.id, { expiring_notified_at: new Date() });
  }

  for (const doc of await repo.expiredBefore(today)) {
    const label = DOC_TYPE_LABEL[doc.doc_type] ?? DOC_TYPE_LABEL["other"]!;
    for (const userId of await repo.orgAdminUserIds(doc.org_id)) {
      await notifications.notify(userId, "compliance_doc_expired", {
        title: `${label} has expired`,
        body: `${doc.file_name}${doc.reference ? ` (${doc.reference})` : ""} expired on ${String(doc.expiry_date).slice(0, 10)}. Proposals that reference it should be updated.`,
        ctaUrl: "/sales/settings/compliance-docs",
      });
    }
    await repo.update(doc.id, { expired_notified_at: new Date() });
  }
}

export function registerComplianceExpiryWorker(db: Knex, manager: QueueManager): void {
  manager.startRepeating<ComplianceExpiryJobData>(
    COMPLIANCE_EXPIRY_QUEUE,
    INTERVAL_MS,
    () => runComplianceExpirySweep(db, manager),
    { _tick: 0 },
  );
}
