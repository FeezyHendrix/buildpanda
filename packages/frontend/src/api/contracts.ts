import api from "./client";

/**
 * Contracts on a build: the main contract plus one per executed change order.
 * A contract is a signed commercial record — its status moves Draft → Pending →
 * Signed, and Signed needs the executed document attached. Phases (stages)
 * point at the contract that prices them via `contractId`.
 */

export const CONTRACT_STATUSES = ["Draft", "Pending", "Signed"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type ContractKind = "main" | "change_order";

export interface Contract {
  id: string;
  projectId?: string;
  kind: ContractKind;
  changeRequestId: string | null;
  title: string;
  trade: string | null;
  legalEntity: string | null;
  total: number;
  status: ContractStatus;
  signedAt: string | null;
  documentId: string | null;
  documentName: string | null;
  phaseCount: number;
  createdAt: string;
}

/** A new contract is always a change-order contract; the main one is derived from the contract terms. */
export interface CreateContractInput {
  title: string;
  trade?: string | null;
  legalEntity?: string | null;
  total?: number;
}

/** Totals are not patched: the main total tracks the contract sum, a change order's its change request. */
export interface UpdateContractInput {
  title?: string;
  trade?: string | null;
  legalEntity?: string | null;
  status?: ContractStatus;
  documentId?: string | null;
  signedAt?: string | null;
}

export const contractsApi = {
  list: (projectId: string) =>
    api.get<Contract[]>(`/projects/${projectId}/contracts`).then((r) => r.data),

  create: (projectId: string, body: CreateContractInput) =>
    api.post<Contract>(`/projects/${projectId}/contracts`, body).then((r) => r.data),

  update: (projectId: string, contractId: string, body: UpdateContractInput) =>
    api.patch<Contract>(`/projects/${projectId}/contracts/${contractId}`, body).then((r) => r.data),

  remove: (projectId: string, contractId: string) =>
    api.delete(`/projects/${projectId}/contracts/${contractId}`).then((r) => r.data),
};
