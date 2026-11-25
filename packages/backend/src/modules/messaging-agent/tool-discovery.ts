import type { Knex } from "knex";
import { runQueries } from "../../lib/run-queries.ts";
import { expenseReaderId } from "../transactions/access.ts";
import { messagingFinancialTargetRepository } from "./financial-target-repository.ts";
import { ForbiddenError } from "../../lib/errors.ts";
import { validateFieldPayload } from "../field-actions/tool-schema.ts";
import { canRead, toolsForCaller } from "../panda-ai/agent/tool-permissions.ts";
import { buildTools } from "../panda-ai/agent/tools.ts";
import { voiceReportRepository } from "../panda-ai/voice-report/repository.ts";
import { voiceContextRepository } from "../panda-ai/voice-report/context-repository.ts";
import { computeAccess } from "../participants/access.ts";
import { dailyLogTemplatesRepository } from "../daily-log-templates/repository.ts";
import { suppliersRepository } from "../suppliers/repository.ts";
import { suppliersService } from "../suppliers/service.ts";
import { buildTasksServices } from "../tasks/wiring.ts";
import { boqJobsRepository, dedupeBoqMaterials } from "../materials-equipment/boq-jobs-repository.ts";
import { requireFileRead, requireFileStaging } from "../files/access.ts";
import { filesRepository } from "../files/repository.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import type { MessagingAccess } from "./management-types.ts";
import type { MessagingScope } from "./types.ts";
import type { MessagingToolDiscovery } from "./tool-discovery-types.ts";
import { authorizationBinding, messagingDiscoveryContext, requireMessagingReadTargets } from "./tool-discovery-context.ts";
import { messagingReadToolEnabled, messagingReadContext } from "./tool-discovery-policy.ts";
import { messagingToolDiscoveryRepository } from "./tool-discovery-repository.ts";
import { messagingActionDescriptors } from "./tool-discovery-descriptors.ts";

/** Every description, target and read result is scoped to the caller's current backend access. */
export async function messagingToolDiscovery(db: Knex, access: MessagingAccess, scope: MessagingScope): Promise<MessagingToolDiscovery> {
  const current = await messagingDiscoveryContext(db, access.user.id, scope), { field, context } = current;
  const boundAccess = authorizationBinding(current);
  if (authorizationBinding(current, access) !== boundAccess) throw new ForbiddenError("Your project access changed during this lookup. Send the request again.");
  const can = (resource: string, action: string) => canRead(context, resource, action);
  const workspaceCan = (resource: string, action: string) => context.readableResource!(resource) &&
    (current.access.workspacePermissions?.[resource]?.includes(action) === true);
  const capabilities = computeAccess(field.project, { ...field.request, user: field.user }).capabilities;
  const internal = capabilities.canViewInternalRfis, repository = messagingToolDiscoveryRepository(db);
  const projectId = scope.projectId, owner = { projectId, organizationId: scope.organizationId };
  let uploads = true;
  try { await requireFileStaging(field.request, projectId); }
  catch (error) { if (error instanceof ForbiddenError) uploads = false; else throw error; }
  const approvalContext = { ...context, readableResource: (resource: string) => resource === "materials" || context.readableResource!(resource) };
  const [snapshot, options, rfis, ledger, entries, templates, suppliers, versions, files, assignees, boq] = await runQueries(db, [
    async () => voiceReportRepository(db).snapshot(projectId, (resource) => can(resource, "view"), !internal, current.access.features.materialLogs),
    async () => voiceContextRepository(db).options(projectId, { userId: field.user.id, organizationId: scope.organizationId ?? "", can: (resource, action) => canRead(approvalContext, resource, action), workspaceCan, capabilities }),
    async () => can("rfis", "view") ? repository.rfis(projectId, !internal) : [],
    async () => can("materials", "view") && current.access.features.materialLogs ? repository.ledgerEntries(projectId) : [],
    async () => can("dailyLog", "view") ? repository.diaryEntries(projectId, scope.buildingId) : [],
    async () => can("dailyLog", "view") ? dailyLogTemplatesRepository(db).list(owner, false) : [],
    async () => can("materials", "view") ? suppliersService(suppliersRepository(db)).list(owner) : [],
    async () => can("documents", "view") ? repository.documentVersions(projectId) : [],
    async () => repository.ownFiles(projectId, field.user.id),
    async () => can("tasks", "view") ? buildTasksServices(db).service.listAssignable(projectId, scope.organizationId, field.project.owner_id, field.user.id) : [],
    async () => can("materials", "view") ? boqJobsRepository(db).listCompletedMaterials(projectId) : [],
  ]);
  const fileRows = await filesRepository(db).findByIds(files.map((file) => file.value));
  const permittedFiles = new Set<string>();
  for (const file of fileRows) {
    try { await requireFileRead(field.request, file, fileAccessRepository(db)); permittedFiles.add(file.id); }
    catch (error) { if (!(error instanceof ForbiddenError)) throw error; }
  }
  const dailyLogEntries = entries.map((entry) => ({ ...entry, logDate: (entry.logDate instanceof Date ? entry.logDate.toISOString() : String(entry.logDate)).slice(0, 10) }));
  const allAssignees = assignees.map((row) => ({ value: row.id, label: row.name, kind: row.kind }));
  const importedBoq = dedupeBoqMaterials(boq).map((row) => ({ ...row, value: row.materialName, label: row.materialName }));
  const voiceOptions = { ...options, assignees: allAssignees.filter((row) => row.kind === "user"),
    teamMembers: allAssignees.filter((row) => row.kind === "team"), taskAssignees: allAssignees,
    buildings: snapshot.buildings.map((row) => ({ value: row.id, label: row.name })),
    stages: snapshot.stages.map((row) => ({ value: row.id, label: row.name, buildingId: row.buildingId })),
    rfis: rfis.map((row) => ({ value: row.id, label: `RFI-${row.number}: ${row.subject}`, status: row.status })),
    respondableRfis: rfis.filter((row) => ["Open", "InReview", "Answered"].includes(row.status)).map((row) => ({ value: row.id, label: `RFI-${row.number}: ${row.subject}` })),
    receivableOrders: snapshot.materialOrders.filter((row) => ["Approved", "Ordered", "PartiallyDelivered", "Delivered"].includes(row.status)).map((row) => ({ value: row.id, label: row.title })),
    reopenableApprovals: options.materialApprovals?.filter((row) => row.status !== "Pending") ?? [],
    dailyLogEntries: dailyLogEntries.map((row) => ({ value: row.id, label: `${row.logDate}: ${row.snippet || row.authorName}`, buildingId: row.buildingId })),
    templates: templates.map((row) => ({ value: row.id, label: row.name, fields: row.fields })),
    suppliers: suppliers.map((row) => ({ value: row.id, label: row.name })), documentVersions: versions, files: files.filter((file) => permittedFiles.has(file.value)),
    boqMaterials: importedBoq, importedBoq,
  };
  const tools = messagingActionDescriptors(current.access);
  const financial = messagingFinancialTargetRepository(db);
  const [expenses, invoices, purchaseOrders] = await runQueries(db, [
    async () => can("finances", "viewCosts") && current.access.features.enabled?.["commercial.transactions"] ? financial.expenses(projectId, expenseReaderId(field.request, field.project)) : [],
    async () => can("finances", "view") && current.access.features.enabled?.["commercial.invoices"] ? financial.invoices(projectId, can("finances", "viewCosts")) : [],
    async () => can("finances", "viewCosts") && current.access.features.enabled?.["commercial.purchaseOrders"] ? financial.purchaseOrders(projectId) : [],
  ]);
  const availableReads = buildTools().flatMap((tool) => {
    const readContext = messagingReadContext(context, tool.spec.function.name);
    return toolsForCaller([tool], readContext).filter((entry) => messagingReadToolEnabled(entry, readContext, current.access.features));
  });
  const executedReads: string[] = [];
  return { tools, targets: { ...voiceOptions, ...snapshot, expenses, invoices, purchaseOrders, rfis, projectGeneral: can("messages", "view") && can("messages", "send") ? { projectId, label: "General", target: { projectGeneral: true }, requiresConfirmation: true } : null, ledgerEntries: ledger.map((row) => ({ ...row, quantity: Number(row.quantity) })),
    dailyLogEntries, todayEntries: dailyLogEntries.filter((entry) => entry.logDate === snapshot.today), voiceOptions, options: voiceOptions }, executedReads, uploads,
  reads: availableReads.map((entry) => entry.spec.function),
  async runRead(name, args) {
    const result = await db.transaction(async (transaction) => {
      const fresh = await messagingDiscoveryContext(transaction, access.user.id, scope);
      if (authorizationBinding(fresh) !== boundAccess) throw new ForbiddenError("Your project access changed during this lookup. Send the request again.");
      const readContext = messagingReadContext(fresh.context, name);
      const tool = buildTools().find((candidate) => candidate.spec.function.name === name);
      const entry = tool && toolsForCaller([tool], readContext).find((candidate) => messagingReadToolEnabled(candidate, readContext, fresh.access.features));
      if (!entry) throw new ForbiddenError("This read tool is not available with your current permissions.");
      const validated = validateFieldPayload<Record<string, unknown>>(entry.spec.function.parameters, structuredClone(args));
      await requireMessagingReadTargets(transaction, projectId, validated);
      return (await entry.run(readContext, validated)).output;
    }, db.isTransaction ? { readOnly: true } : { readOnly: true, isolationLevel: "repeatable read" });
    if (!executedReads.includes(name)) executedReads.push(name);
    return result;
  } };
}
