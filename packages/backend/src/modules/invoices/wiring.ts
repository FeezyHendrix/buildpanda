import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { toContractTerms } from "../finances/contract-terms.ts";
import { financesRepository } from "../finances/repository.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { invoiceCertificateRepository } from "./certificate-repository.ts";
import { invoiceCertificateService } from "./certificate.ts";
import { invoiceNotifier } from "./invoice-notifier.ts";
import { invoicesRepository } from "./repository.ts";

export function buildInvoiceCertificateService(db: Knex, queue?: QueueManager) {
  const finances = financesRepository(db);
  const notifier = invoiceNotifier(
    notificationsService(notificationsRepository(db), queue),
    db,
  );
  // Recording a receipt goes through the certificate service, where the guards
  // and the audit trail live — a payment is never a bare insert.
  return invoiceCertificateService({
    invoices: invoicesRepository(db),
    certificates: invoiceCertificateRepository(db),
    terms: async (projectId) => {
      const row = await finances.findSummary(projectId);
      return row ? toContractTerms(row) : null;
    },
    adjustedContract: async (projectId) => {
      const row = await finances.findSummary(projectId);
      return row ? Number(row.contract_sum) + Number(row.variations_total) : 0;
    },
    onEvent: (projectId, invoice, type, actor, reason) =>
      notifier.statusChanged(projectId, invoice, type, actor, reason),
  });
}
