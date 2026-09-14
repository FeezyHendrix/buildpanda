export const CONTRACT_KINDS = ["main", "change_order"] as const;
export const CONTRACT_STATUSES = ["Draft", "Pending", "Signed"] as const;

export type ContractKind = (typeof CONTRACT_KINDS)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface Contract {
  id: string;
  projectId: string;
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
  /** Build stages attributed to this contract; null stages count on the main contract. */
  phaseCount: number;
  createdAt: string;
}

export interface ContractRow {
  id: string;
  project_id: string;
  kind: ContractKind;
  change_request_id: string | null;
  title: string;
  trade: string | null;
  legal_entity: string | null;
  total: string;
  status: ContractStatus;
  document_id: string | null;
  signed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface NewContractRecord {
  id: string;
  project_id: string;
  kind: ContractKind;
  change_request_id: string | null;
  title: string;
  trade: string | null;
  legal_entity: string | null;
  total: string;
  status: ContractStatus;
  document_id: string | null;
  signed_at: string | null;
}

export interface ContractUpdatePatch {
  title?: string;
  trade?: string | null;
  legal_entity?: string | null;
  total?: string;
  status?: ContractStatus;
  document_id?: string | null;
  signed_at?: string | null;
  updated_at?: Date;
}

export interface CreateContractInput {
  title: string;
  trade?: string | null;
  legalEntity?: string | null;
  total?: number;
}

export interface UpdateContractInput {
  title?: string;
  trade?: string | null;
  legalEntity?: string | null;
  status?: ContractStatus;
  documentId?: string | null;
  signedAt?: string | null;
}

/** The change-request facts a change-order contract is generated from. */
export interface ChangeOrderSource {
  id: string;
  title: string;
  costImpact: number;
}

/** Stage count per contract id; the key `null` is the main-contract bucket. */
export interface ContractPhaseCountRow {
  contract_id: string | null;
  count: string;
}
