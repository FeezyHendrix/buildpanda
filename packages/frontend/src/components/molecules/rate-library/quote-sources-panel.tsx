import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import type { QuoteSource, QuoteStatus, RateCard } from "@/api/rate-library";
import { useAddQuoteSource, useDeleteQuoteSource, useQuoteSources } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STATUS_META: Record<QuoteStatus, { label: string; tone: BadgeTone }> = {
  valid: { label: "Valid", tone: "success" },
  expiring: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  open: { label: "No expiry", tone: "neutral" },
};

const selectClass = cn(
  "h-9 w-full rounded-lg bg-[#F6F6F6] px-2 text-xs text-gray-900",
  "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

function QuoteRow({ quote, rateLabel, currency, canManage }: { quote: QuoteSource; rateLabel: string | null; currency: string; canManage: boolean }) {
  const remove = useDeleteQuoteSource();
  const meta = STATUS_META[quote.status];
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{quote.supplierName}</p>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {rateLabel ? `For ${rateLabel}` : "Not linked to a rate"}
          {quote.amount !== null ? ` · ${formatWholeCurrency(quote.amount, currency)}${quote.unit ? ` per ${quote.unit}` : ""}` : ""}
          {quote.reference ? ` · ${quote.reference}` : ""}
          {quote.validUntil ? ` · valid to ${formatShortDate(quote.validUntil)}` : ""}
        </p>
      </div>
      {canManage ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:bg-red-50"
          loading={remove.isPending}
          onClick={() => remove.mutate(quote.id, { onError: (e) => toast(getApiErrorMessage(e, "Could not remove the quote."), "error") })}
        >
          Remove
        </Button>
      ) : null}
    </li>
  );
}
QuoteRow.displayName = "QuoteRow";

export function QuoteSourcesPanel({ cards, canManage }: { cards: RateCard[]; canManage: boolean }) {
  const { data: quotes = [], isPending } = useQuoteSources();
  const add = useAddQuoteSource();
  const [supplierName, setSupplierName] = useState("");
  const [rateId, setRateId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const rateLabelById = new Map<string, string>();
  for (const card of cards) for (const rate of card.rates) rateLabelById.set(rate.id, rate.label ?? rate.descriptionPattern ?? rate.unit);
  const currency = cards[0]?.currency ?? "NGN";
  const valid = supplierName.trim().length > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Supplier and subcontractor quotes</h2>
        <p className="text-xs text-gray-500">A dated quote backs a rate. Expiring quotes are flagged thirty days out.</p>
      </div>
      {isPending ? null : quotes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">No quotes recorded. Add the supplier, the figure and the date it is valid to.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {quotes.map((q) => (
            <QuoteRow key={q.id} quote={q} rateLabel={q.rateId ? (rateLabelById.get(q.rateId) ?? null) : null} currency={currency} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage ? (
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] items-end gap-2 border-t border-gray-100 px-4 py-3">
          <Input className="h-9 text-xs" placeholder="Supplier or subcontractor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <select className={selectClass} value={rateId} onChange={(e) => setRateId(e.target.value)} aria-label="Linked rate">
            <option value="">Not linked to a rate</option>
            {cards.map((card) =>
              card.rates.map((rate) => (
                <option key={rate.id} value={rate.id}>{card.name}: {rate.label ?? rate.descriptionPattern ?? rate.unit}</option>
              )),
            )}
          </select>
          <Input className="h-9 text-xs" type="number" min="0" step="any" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input className="h-9 text-xs" placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input className="h-9 text-xs" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} aria-label="Valid until" />
          <Button
            size="sm"
            disabled={!valid}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { supplierName: supplierName.trim(), rateId: rateId || null, amount: amount ? parseFloat(amount) : null, reference: reference.trim() || null, validUntil: validUntil || null },
                {
                  onSuccess: () => { setSupplierName(""); setAmount(""); setReference(""); setValidUntil(""); setRateId(""); },
                  onError: (e) => toast(getApiErrorMessage(e, "Could not add the quote."), "error"),
                },
              )
            }
          >
            Add quote
          </Button>
        </div>
      ) : null}
    </section>
  );
}
QuoteSourcesPanel.displayName = "QuoteSourcesPanel";
