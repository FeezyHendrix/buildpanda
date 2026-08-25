export interface SampleProjectContext {
  projectId: string;
  buildingId: string;
  sharedBuildingId: string;
  organizationId: string | null;
  ownerId: string | null;
  // The seed data was written with hardcoded child ids ("p1", "act-1", …) because
  // there was only ever one sample project. Every sample project now routes its
  // child ids through here so several can coexist: the canonical singleton maps a
  // suffix to itself and keeps existing rows byte-identical, while a per-workspace
  // copy namespaces it under the project id.
  id(suffix: string): string;
}

export interface TableRows {
  table: string;
  rows: Record<string, unknown>[];
}

// Ordered parent-before-child so a plain sequential insert satisfies every FK.
export type SampleProjectDataset = TableRows[];

// A circular foreign key cannot be satisfied by any insert order, so the link is
// applied after both sides exist — still inside the provisioning transaction.
export interface DeferredUpdate {
  table: string;
  where: Record<string, unknown>;
  patch: Record<string, unknown>;
}

export interface ProvisionResult {
  created: boolean;
  projectId: string;
}
