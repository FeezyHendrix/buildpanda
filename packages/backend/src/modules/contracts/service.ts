import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { DocumentsRepository } from "../documents/repository.ts";
import type { FinancesRepository } from "../finances/repository.ts";
import type { StagesRepository } from "../stages/repository.ts";
import type { ContractsRepository } from "./repository.ts";
import type {
  ChangeOrderSource,
  Contract,
  ContractRow,
  ContractUpdatePatch,
  CreateContractInput,
  UpdateContractInput,
} from "./types.ts";

export interface ContractsDeps {
  finances: Pick<FinancesRepository, "findSummary">;
  stages: Pick<StagesRepository, "countByContract">;
  documents: Pick<DocumentsRepository, "fileNamesByIds">;
}

const MAIN_CONTRACT_TITLE = "Main contract";

function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toContract(
  row: ContractRow,
  documentName: string | null,
  phaseCount: number,
): Contract {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    changeRequestId: row.change_request_id,
    title: row.title,
    trade: row.trade,
    legalEntity: row.legal_entity,
    total: Number(row.total),
    status: row.status,
    signedAt: iso(row.signed_at),
    documentId: row.document_id,
    documentName,
    phaseCount,
    createdAt: timestamp(row.created_at),
  };
}

function clean(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function contractsService(repository: ContractsRepository, deps: ContractsDeps) {
  /**
   * The main contract is the finances contract terms seen as a contract record,
   * so it is created on first read and its total always mirrors the contract
   * sum — the terms page stays the single place the sum is edited.
   */
  async function ensureMain(projectId: string): Promise<ContractRow> {
    const summary = await deps.finances.findSummary(projectId);
    const contractSum = summary ? Number(summary.contract_sum) : 0;
    const existing = await repository.findMain(projectId);
    const main =
      existing ??
      (await repository.createMainIfMissing({
        id: generateId("con"),
        project_id: projectId,
        kind: "main",
        change_request_id: null,
        title: MAIN_CONTRACT_TITLE,
        trade: null,
        legal_entity: null,
        total: contractSum.toFixed(2),
        status: "Draft",
        document_id: null,
        signed_at: null,
      }));
    if (Number(main.total) !== contractSum) {
      return (await repository.update(main.id, { total: contractSum.toFixed(2) })) ?? main;
    }
    return main;
  }

  async function decorate(projectId: string, rows: ContractRow[]): Promise<Contract[]> {
    const mainId = rows.find((row) => row.kind === "main")?.id ?? null;
    const documentIds = rows.map((row) => row.document_id).filter((id): id is string => id !== null);
    const [names, counts] = await Promise.all([
      deps.documents.fileNamesByIds(documentIds),
      deps.stages.countByContract(projectId),
    ]);
    const countByContract = new Map<string | null, number>();
    for (const count of counts) {
      // Stages with no contract belong to the main contract.
      const key = count.contract_id ?? mainId;
      countByContract.set(key, (countByContract.get(key) ?? 0) + Number(count.count));
    }
    return rows.map((row) =>
      toContract(
        row,
        row.document_id ? (names.get(row.document_id) ?? null) : null,
        countByContract.get(row.id) ?? 0,
      ),
    );
  }

  async function owned(projectId: string, contractId: string): Promise<ContractRow> {
    const row = await repository.findById(contractId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Contract");
    return row;
  }

  return {
    async listByProject(projectId: string): Promise<Contract[]> {
      await ensureMain(projectId);
      return decorate(projectId, await repository.listByProject(projectId));
    },

    async get(projectId: string, contractId: string): Promise<Contract> {
      const [contract] = await decorate(projectId, [await owned(projectId, contractId)]);
      if (!contract) throw new NotFoundError("Contract");
      return contract;
    },

    /** The id every stage without an explicit contract resolves to. */
    async mainContractId(projectId: string): Promise<string> {
      return (await ensureMain(projectId)).id;
    },

    async belongsToProject(projectId: string, contractId: string): Promise<boolean> {
      const row = await repository.findById(contractId);
      return row?.project_id === projectId;
    },

    /** A manually recorded change-order contract (one signed outside the change-request flow). */
    async create(projectId: string, input: CreateContractInput): Promise<Contract> {
      const row = await repository.create({
        id: generateId("con"),
        project_id: projectId,
        kind: "change_order",
        change_request_id: null,
        title: input.title.trim(),
        trade: clean(input.trade),
        legal_entity: clean(input.legalEntity),
        total: (input.total ?? 0).toFixed(2),
        status: "Draft",
        document_id: null,
        signed_at: null,
      });
      const [contract] = await decorate(projectId, [row]);
      return contract as Contract;
    },

    /**
     * An approved change request becomes a change-order contract carrying the
     * request's cost impact — the reference product generates the contract at
     * approval; the signed copy is uploaded afterwards. Idempotent per request.
     */
    async ensureForChangeRequest(projectId: string, source: ChangeOrderSource): Promise<Contract> {
      const existing = await repository.findByChangeRequest(source.id);
      const row =
        existing ??
        (await repository.create({
          id: generateId("con"),
          project_id: projectId,
          kind: "change_order",
          change_request_id: source.id,
          title: `CO - ${source.title}`.slice(0, 200),
          trade: null,
          legal_entity: null,
          total: source.costImpact.toFixed(2),
          status: "Pending",
          document_id: null,
          signed_at: null,
        }));
      const [contract] = await decorate(projectId, [row]);
      return contract as Contract;
    },

    async findByChangeRequest(changeRequestId: string): Promise<Contract | null> {
      const row = await repository.findByChangeRequest(changeRequestId);
      if (!row) return null;
      const [contract] = await decorate(row.project_id, [row]);
      return contract ?? null;
    },

    /** Batched change-request → contract id lookup for list DTOs (no N+1). */
    async idsByChangeRequests(changeRequestIds: string[]): Promise<Map<string, string>> {
      const rows = await repository.listByChangeRequests(changeRequestIds);
      return new Map(
        rows
          .filter((row): row is ContractRow & { change_request_id: string } => row.change_request_id !== null)
          .map((row) => [row.change_request_id, row.id]),
      );
    },

    async update(projectId: string, contractId: string, input: UpdateContractInput): Promise<Contract> {
      const existing = await owned(projectId, contractId);
      const patch: ContractUpdatePatch = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.trade !== undefined) patch.trade = clean(input.trade);
      if (input.legalEntity !== undefined) patch.legal_entity = clean(input.legalEntity);
      if (input.documentId !== undefined) patch.document_id = input.documentId;
      if (input.signedAt !== undefined) patch.signed_at = input.signedAt;
      if (input.status !== undefined) {
        const documentId = input.documentId !== undefined ? input.documentId : existing.document_id;
        // A contract is only "Signed" once the signed copy is on file — the
        // record is evidence of an agreement, not a checkbox.
        if (input.status === "Signed" && !documentId) {
          throw new BadRequestError("Upload the signed contract first");
        }
        patch.status = input.status;
        if (input.status === "Signed" && input.signedAt === undefined && !existing.signed_at) {
          patch.signed_at = new Date().toISOString().slice(0, 10);
        }
      }
      const row = await repository.update(contractId, patch);
      if (!row) throw new NotFoundError("Contract");
      const [contract] = await decorate(projectId, [row]);
      return contract as Contract;
    },

    async remove(projectId: string, contractId: string): Promise<void> {
      const existing = await owned(projectId, contractId);
      if (existing.kind === "main") {
        throw new BadRequestError("The main contract cannot be deleted");
      }
      const counts = await deps.stages.countByContract(projectId);
      const phases = counts.find((count) => count.contract_id === contractId);
      if (phases && Number(phases.count) > 0) {
        throw new ConflictError("Move this contract's stages to another contract before deleting it");
      }
      await repository.remove(contractId);
    },
  };
}

export type ContractsService = ReturnType<typeof contractsService>;
