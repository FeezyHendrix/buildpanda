import api from "./client";

export const BUILDUP_COMPONENTS = ["labour", "material", "plant", "subcontract", "overhead"] as const;
export type BuildupComponent = (typeof BUILDUP_COMPONENTS)[number];

export type QuoteStatus = "valid" | "expiring" | "expired" | "open";

export interface RateBuildup {
  id: string;
  component: BuildupComponent;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  wastePct: number;
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

export interface MatchedRate {
  index: number;
  rateId: string;
  rate: number;
  unit: string;
  cardName: string;
  label: string | null;
}

export const rateLibraryApi = {
  listCards: () => api.get<RateCard[]>("/precon/rate-cards").then((r) => r.data),
  createCard: (body: UpsertRateCardInput) => api.post<RateCard>("/precon/rate-cards", body).then((r) => r.data),
  updateCard: (cardId: string, body: Partial<UpsertRateCardInput>) =>
    api.patch<RateCard>(`/precon/rate-cards/${cardId}`, body).then((r) => r.data),
  deleteCard: (cardId: string) => api.delete(`/precon/rate-cards/${cardId}`).then((r) => r.data),

  addRate: (cardId: string, body: UpsertRateInput) =>
    api.post<Rate>(`/precon/rate-cards/${cardId}/rates`, body).then((r) => r.data),
  updateRate: (cardId: string, rateId: string, body: Partial<UpsertRateInput>) =>
    api.patch<Rate>(`/precon/rate-cards/${cardId}/rates/${rateId}`, body).then((r) => r.data),
  deleteRate: (cardId: string, rateId: string) =>
    api.delete(`/precon/rate-cards/${cardId}/rates/${rateId}`).then((r) => r.data),
  setBuildups: (cardId: string, rateId: string, lines: BuildupInput[]) =>
    api.put<Rate>(`/precon/rate-cards/${cardId}/rates/${rateId}/buildups`, lines).then((r) => r.data),

  matchRates: (items: { code?: string | null; description: string; unit: string }[]) =>
    api.post<MatchedRate[]>("/precon/rate-cards/match", { items }).then((r) => r.data),

  listQuotes: () => api.get<QuoteSource[]>("/precon/quote-sources").then((r) => r.data),
  addQuote: (body: CreateQuoteSourceInput) => api.post<QuoteSource>("/precon/quote-sources", body).then((r) => r.data),
  deleteQuote: (quoteId: string) => api.delete(`/precon/quote-sources/${quoteId}`).then((r) => r.data),
};
