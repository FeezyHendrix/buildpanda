import { financialEvidenceRepository } from "./financial-evidence-repository.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { requireFileAttachment } from "../files/access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import type { CreateTransactionInput } from "../transactions/types.ts";
import { buildTransactionsService } from "../transactions/wiring.ts";
import type { FieldToolHandler } from "./tool-types.ts";

export const expenseRecordHandler: FieldToolHandler = async (input, context) => {
  if (!context.db.isTransaction) return context.db.transaction((trx) => expenseRecordHandler(input, { ...context, db: trx }));
  await context.requireFeature("commercial.transactions", "Transactions");
  const project = await context.request.requireProjectPermission(input.projectId, "finances", "manage");
  const { currency, ...body } = input.payload;
  const current = await projectsRepository(context.db).currencyForShare(project.id);
  if (!current) throw new NotFoundError("Project");
  if (currency !== current.currency) throw new BadRequestError("The expense currency differs from the project's currency. Confirm the amount in the current project currency; Panda cannot guess a conversion.");
  const payload = body as unknown as CreateTransactionInput;
  await requireFileAttachment(context.request, project.id, payload.receiptFileId, filesService(filesRepository(context.db)), fileAccessRepository(context.db));
  const evidence = financialEvidenceRepository(context.db);
  if (payload.receiptFileId) await evidence.lock(project.id, await evidence.fingerprint(payload.receiptFileId));
  if (payload.reference) await evidence.lock(project.id, payload.reference.trim().toLowerCase());
  if (payload.receiptFileId && await evidence.invoicePaymentForEvidence(context, payload.receiptFileId)) throw new BadRequestError("This receipt already records an accessible invoice payment. Review that payment instead of recording a second expense.");
  if (await evidence.duplicateExpense(context, input.payload)) throw new BadRequestError("An accessible expense already uses this receipt or matching vendor reference. Select the existing expense instead of recording it twice.");
  const record = await buildTransactionsService(context.db, context.request, project).create(project.id,
    project.organization_id ?? project.owner_id ?? project.id, context.user.id, payload);
  return { kind: input.kind, projectId: project.id, recordId: record.id, data: { amount: record.amount, currency: current.currency } };
};
