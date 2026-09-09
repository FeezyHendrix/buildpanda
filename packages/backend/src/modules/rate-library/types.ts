export const BUILDUP_COMPONENTS = ["labour", "material", "plant", "subcontract", "overhead"] as const;
export type BuildupComponent = (typeof BUILDUP_COMPONENTS)[number];

export const QUOTE_STATUSES = ["valid", "expiring", "expired", "open"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_EXPIRING_WINDOW_DAYS = 30;

// ---------- rows (snake_case, DB) ----------

export interface RateCardRow {
  id: string;
  org_id: string;
  name: string;
  region: string | null;
  currency: string;
  is_default: boolean;
  created_at: Date;
}

export interface RateRow {
  id: string;
  rate_card_id: string;
  label: string | null;
  code_prefix: string | null;
  description_pattern: string | null;
  unit: string;
  rate: string | number;
  created_at: Date;
}

export interface RateBuildupRow {
  id: string;
  rate_id: string;
  component: BuildupComponent;
  description: string;
  qty: string | number;
  unit: string;
  unit_cost: string | number;
  waste_pct: string | number;
  sort: number;
  created_at: Date;
}

export interface QuoteSourceRow {
  id: string;
  org_id: string;
  rate_id: string | null;
  supplier_name: string;
  reference: string | null;
  valid_until: Date | string | null;
  file_id: string | null;
  amount: string | number | null;
  unit: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

// ---------- DTOs (camelCase, API) ----------

export interface RateBuildup {
  id: string;
  component: BuildupComponent;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  wastePct: number;
  /** qty × unitCost × (1 + wastePct / 100) */
  lineCost: number;
  sort: number;
}

export interface Rate {
  id: string;
  rateCardId: string;
  label: string | null;
  codePrefix: string | null;
  descriptionPattern: string | null;
  unit: string;
  rate: number;
  /** Sum of the build-up lines, null when the rate is a bare figure. */
  buildupTotal: number | null;
  buildups: RateBuildup[];
  quoteCount: number;
}

export interface RateCard {
  id: string;
  name: string;
  region: string | null;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  rates: Rate[];
}

export interface QuoteSource {
  id: string;
  rateId: string | null;
  supplierName: string;
  reference: string | null;
  validUntil: string | null;
  fileId: string | null;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  status: QuoteStatus;
  daysUntilExpiry: number | null;
  createdAt: string;
}

// ---------- inputs ----------

export interface UpsertRateCardInput {
  name: string;
  region?: string | null;
  isDefault?: boolean;
}

export interface UpsertRateInput {
  label?: string | null;
  codePrefix?: string | null;
  descriptionPattern?: string | null;
  unit: string;
  rate: number;
}

export interface BuildupInput {
  component: BuildupComponent;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  wastePct?: number;
}

export interface CreateQuoteSourceInput {
  rateId?: string | null;
  supplierName: string;
  reference?: string | null;
  validUntil?: string | null;
  fileId?: string | null;
  amount?: number | null;
  unit?: string | null;
  notes?: string | null;
}

export interface MatchRatesInput {
  items: { code?: string | null; description: string; unit: string }[];
}

export interface MatchedRate {
  index: number;
  rateId: string;
  rate: number;
  unit: string;
  cardName: string;
  label: string | null;
}

// ---------- assemblies (one drawn quantity, several bill items) ----------

export interface AssemblyItem {
  description: string;
  unit: string;
  /** quantity of this item per one unit of the assembly's measured quantity */
  factor: number;
  elementGroup: string;
  rateId: string | null;
  code: string | null;
}

export interface PreconAssemblyRow {
  id: string;
  org_id: string;
  name: string;
  unit: string;
  element_group: string;
  items: AssemblyItem[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PreconAssembly {
  id: string;
  name: string;
  unit: string;
  elementGroup: string;
  items: AssemblyItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAssemblyInput {
  name: string;
  unit: string;
  elementGroup: string;
  items: AssemblyItem[];
}

/** An assembly with every item's rate resolved from the org's cards, ready to bill. */
export interface PricedAssemblyItem extends AssemblyItem {
  rate: number | null;
}

export interface PricedAssembly extends Omit<PreconAssembly, "items"> {
  items: PricedAssemblyItem[];
}
