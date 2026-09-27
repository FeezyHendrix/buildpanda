import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { matchRate } from "../panda-ai/pdf-takeoff/engine/price.ts";
import type { RateLibraryRepository } from "./repository.ts";
import {
  QUOTE_EXPIRING_WINDOW_DAYS,
  type BuildupInput,
  type CreateQuoteSourceInput,
  type MatchRatesInput,
  type MatchedRate,
  type QuoteSource,
  type QuoteSourceRow,
  type QuoteStatus,
  type Rate,
  type RateBuildup,
  type RateBuildupRow,
  type RateCard,
  type RateCardRow,
  type RateRow,
  type UpsertRateCardInput,
  type UpsertRateInput,
} from "./types.ts";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** qty × unit cost, plus waste on top. Waste is a percentage of the net cost. */
export function buildupLineCost(qty: number, unitCost: number, wastePct: number): number {
  return round2(qty * unitCost * (1 + wastePct / 100));
}

export function buildupTotal(lines: { qty: number; unitCost: number; wastePct: number }[]): number {
  return round2(lines.reduce((sum, l) => sum + buildupLineCost(l.qty, l.unitCost, l.wastePct), 0));
}

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const target = new Date(String(date).slice(0, 10)).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function quoteStatus(validUntil: Date | string | null): { status: QuoteStatus; daysUntilExpiry: number | null } {
  const days = daysUntil(validUntil);
  if (days === null) return { status: "open", daysUntilExpiry: null };
  if (days < 0) return { status: "expired", daysUntilExpiry: days };
  if (days <= QUOTE_EXPIRING_WINDOW_DAYS) return { status: "expiring", daysUntilExpiry: days };
  return { status: "valid", daysUntilExpiry: days };
}

function toBuildup(r: RateBuildupRow): RateBuildup {
  const qty = Number(r.qty);
  const unitCost = Number(r.unit_cost);
  const wastePct = Number(r.waste_pct);
  return {
    id: r.id,
    component: r.component,
    description: r.description,
    qty,
    unit: r.unit,
    unitCost,
    wastePct,
    lineCost: buildupLineCost(qty, unitCost, wastePct),
    sort: r.sort,
  };
}

function toRate(r: RateRow, buildups: RateBuildupRow[], quoteCount: number): Rate {
  const lines = buildups.map(toBuildup);
  return {
    id: r.id,
    rateCardId: r.rate_card_id,
    label: r.label,
    codePrefix: r.code_prefix,
    descriptionPattern: r.description_pattern,
    unit: r.unit,
    rate: Number(r.rate),
    buildupTotal: lines.length ? round2(lines.reduce((s, l) => s + l.lineCost, 0)) : null,
    buildups: lines,
    quoteCount,
  };
}

function toCard(r: RateCardRow, rates: Rate[]): RateCard {
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    currency: r.currency,
    isDefault: r.is_default,
    createdAt: new Date(r.created_at).toISOString(),
    rates,
  };
}

function toQuote(r: QuoteSourceRow): QuoteSource {
  const { status, daysUntilExpiry } = quoteStatus(r.valid_until);
  return {
    id: r.id,
    rateId: r.rate_id,
    supplierName: r.supplier_name,
    reference: r.reference,
    validUntil: r.valid_until ? String(r.valid_until).slice(0, 10) : null,
    fileId: r.file_id,
    amount: r.amount === null ? null : Number(r.amount),
    unit: r.unit,
    notes: r.notes,
    status,
    daysUntilExpiry,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export function rateLibraryService(repo: RateLibraryRepository) {
  async function assertCard(orgId: string, cardId: string): Promise<RateCardRow> {
    const card = await repo.cardById(cardId);
    if (!card || card.org_id !== orgId) throw new NotFoundError("Rate card");
    return card;
  }

  async function assertRate(orgId: string, cardId: string, rateId: string): Promise<RateRow> {
    await assertCard(orgId, cardId);
    const rate = await repo.rateById(rateId);
    if (!rate || rate.rate_card_id !== cardId) throw new NotFoundError("Rate");
    return rate;
  }

  // Cards, their rates, build-ups and quote counts in four queries, not N.
  async function hydrate(cards: RateCardRow[]): Promise<RateCard[]> {
    const rates = await repo.ratesByCards(cards.map((c) => c.id));
    const rateIds = rates.map((r) => r.id);
    const [buildups, quoteCounts] = await Promise.all([repo.buildupsByRates(rateIds), repo.quoteCountsByRates(rateIds)]);
    const buildupsByRate = new Map<string, RateBuildupRow[]>();
    for (const b of buildups) buildupsByRate.set(b.rate_id, [...(buildupsByRate.get(b.rate_id) ?? []), b]);
    const ratesByCard = new Map<string, Rate[]>();
    for (const r of rates) {
      const dto = toRate(r, buildupsByRate.get(r.id) ?? [], quoteCounts.get(r.id) ?? 0);
      ratesByCard.set(r.rate_card_id, [...(ratesByCard.get(r.rate_card_id) ?? []), dto]);
    }
    return cards.map((c) => toCard(c, ratesByCard.get(c.id) ?? []));
  }

  async function getCard(orgId: string, cardId: string): Promise<RateCard> {
    const card = await assertCard(orgId, cardId);
    return (await hydrate([card]))[0]!;
  }

  return {
    async listCards(orgId: string): Promise<RateCard[]> {
      return hydrate(await repo.cardsByOrg(orgId));
    },

    getCard,

    async createCard(orgId: string, input: UpsertRateCardInput, currency: string): Promise<RateCard> {
      const existing = await repo.cardsByOrg(orgId);
      const card = await repo.insertCard({
        id: generateId("prc"),
        org_id: orgId,
        name: input.name.trim(),
        region: input.region?.trim() || null,
        currency,
        // the first card an org creates is its default until it says otherwise
        is_default: input.isDefault ?? existing.length === 0,
      });
      if (card.is_default) await repo.setDefaultCard(orgId, card.id);
      return toCard({ ...card, is_default: card.is_default }, []);
    },

    async updateCard(orgId: string, cardId: string, input: Partial<UpsertRateCardInput>): Promise<RateCard> {
      await assertCard(orgId, cardId);
      const patch: Partial<Pick<RateCardRow, "name" | "region">> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.region !== undefined) patch.region = input.region?.trim() || null;
      if (Object.keys(patch).length) await repo.updateCard(cardId, patch);
      if (input.isDefault) await repo.setDefaultCard(orgId, cardId);
      return getCard(orgId, cardId);
    },

    async removeCard(orgId: string, cardId: string): Promise<{ ok: true }> {
      await assertCard(orgId, cardId);
      await repo.deleteCard(cardId);
      return { ok: true };
    },

    async addRate(orgId: string, cardId: string, input: UpsertRateInput): Promise<Rate> {
      await assertCard(orgId, cardId);
      const rate = await repo.insertRate({
        id: generateId("prt"),
        rate_card_id: cardId,
        label: input.label?.trim() || null,
        code_prefix: input.codePrefix?.trim() || null,
        description_pattern: input.descriptionPattern?.trim() || null,
        unit: input.unit.trim(),
        rate: input.rate,
      });
      return toRate(rate, [], 0);
    },

    async updateRate(orgId: string, cardId: string, rateId: string, input: Partial<UpsertRateInput>): Promise<Rate> {
      await assertRate(orgId, cardId, rateId);
      const patch: Partial<Omit<RateRow, "id" | "rate_card_id" | "created_at">> = {};
      if (input.label !== undefined) patch.label = input.label?.trim() || null;
      if (input.codePrefix !== undefined) patch.code_prefix = input.codePrefix?.trim() || null;
      if (input.descriptionPattern !== undefined) patch.description_pattern = input.descriptionPattern?.trim() || null;
      if (input.unit !== undefined) patch.unit = input.unit.trim();
      if (input.rate !== undefined) patch.rate = input.rate;
      const updated = (await repo.updateRate(rateId, patch))!;
      const [buildups, counts] = await Promise.all([repo.buildupsByRates([rateId]), repo.quoteCountsByRates([rateId])]);
      return toRate(updated, buildups, counts.get(rateId) ?? 0);
    },

    async removeRate(orgId: string, cardId: string, rateId: string): Promise<{ ok: true }> {
      await assertRate(orgId, cardId, rateId);
      await repo.deleteRate(rateId, cardId);
      return { ok: true };
    },

    // Replacing the build-up also rewrites the rate figure: the build-up is the
    // rate's justification, so the two can never disagree.
    async setBuildups(orgId: string, cardId: string, rateId: string, lines: BuildupInput[]): Promise<Rate> {
      const rate = await assertRate(orgId, cardId, rateId);
      for (const line of lines) {
        if (line.qty < 0 || line.unitCost < 0 || (line.wastePct ?? 0) < 0) {
          throw new BadRequestError("Build-up quantities, costs and waste cannot be negative");
        }
      }
      const rows = lines.map((line, i) => ({
        id: generateId("prb"),
        rate_id: rateId,
        component: line.component,
        description: line.description.trim(),
        qty: line.qty,
        unit: line.unit.trim() || "item",
        unit_cost: line.unitCost,
        waste_pct: line.wastePct ?? 0,
        sort: i,
      }));
      const total = lines.length
        ? buildupTotal(lines.map((l) => ({ qty: l.qty, unitCost: l.unitCost, wastePct: l.wastePct ?? 0 })))
        : Number(rate.rate);
      await repo.replaceBuildups(rateId, rows, total);
      const [updated, buildups, counts] = await Promise.all([
        repo.rateById(rateId),
        repo.buildupsByRates([rateId]),
        repo.quoteCountsByRates([rateId]),
      ]);
      return toRate(updated!, buildups, counts.get(rateId) ?? 0);
    },

    async listQuotes(orgId: string): Promise<QuoteSource[]> {
      return (await repo.quotesByOrg(orgId)).map(toQuote);
    },

    async addQuote(orgId: string, userId: string, input: CreateQuoteSourceInput): Promise<QuoteSource> {
      if (input.rateId) {
        const rate = await repo.rateById(input.rateId);
        const card = rate ? await repo.cardById(rate.rate_card_id) : null;
        if (!rate || !card || card.org_id !== orgId) throw new NotFoundError("Rate");
      }
      const row = await repo.insertQuote({
        id: generateId("pqs"),
        org_id: orgId,
        rate_id: input.rateId ?? null,
        supplier_name: input.supplierName.trim(),
        reference: input.reference?.trim() || null,
        valid_until: input.validUntil ?? null,
        file_id: input.fileId ?? null,
        amount: input.amount ?? null,
        unit: input.unit?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: userId,
      });
      return toQuote(row);
    },

    async removeQuote(orgId: string, quoteId: string): Promise<{ ok: true }> {
      const deleted = await repo.deleteQuote(quoteId, orgId);
      if (!deleted) throw new NotFoundError("Quote");
      return { ok: true };
    },

    // Match estimate lines against the org's default card using the same
    // matcher the take-off engine prices with, so both agree on what "matches".
    async matchRates(orgId: string, input: MatchRatesInput): Promise<MatchedRate[]> {
      const card = await repo.defaultCardForOrg(orgId);
      if (!card) return [];
      const rates = await repo.ratesByCards([card.id]);
      const matches: MatchedRate[] = [];
      input.items.forEach((item, index) => {
        const hit = matchRate({ code: item.code ?? null, description: item.description, unit: item.unit, qty: null }, rates);
        const full = hit ? rates.find((r) => r.id === hit.id) : undefined;
        if (full) {
          matches.push({ index, rateId: full.id, rate: Number(full.rate), unit: full.unit, cardName: card.name, label: full.label });
        }
      });
      return matches;
    },
  };
}
