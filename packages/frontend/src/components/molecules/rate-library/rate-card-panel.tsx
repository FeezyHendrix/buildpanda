import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Input } from "@/components/atoms/input";
import type { Rate, RateCard } from "@/api/rate-library";
import { useAddRate, useDeleteRate, useDeleteRateCard, useUpdateRateCard } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatWholeCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";

interface Props {
  card: RateCard;
  canManage: boolean;
  onBuildUp: (rate: Rate) => void;
}

function RateRow({ card, rate, canManage, onBuildUp }: { card: RateCard; rate: Rate; canManage: boolean; onBuildUp: (rate: Rate) => void }) {
  const remove = useDeleteRate();
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-900">
        {rate.label ?? rate.descriptionPattern ?? "Unlabelled rate"}
        {rate.codePrefix ? <span className="ml-2 font-mono text-[11px] text-gray-400">{rate.codePrefix}</span> : null}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{rate.unit}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-900">{formatWholeCurrency(rate.rate, card.currency)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {rate.buildups.length > 0 ? `${rate.buildups.length}-line build-up` : "Bare figure"}
        {rate.quoteCount > 0 ? ` · ${rate.quoteCount} quote${rate.quoteCount === 1 ? "" : "s"}` : ""}
      </td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <span className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onBuildUp(rate)}>Build up</Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate({ cardId: card.id, rateId: rate.id }, {
                  onError: (e) => toast(getApiErrorMessage(e, "Could not remove the rate."), "error"),
                })
              }
            >
              Remove
            </Button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}
RateRow.displayName = "RateRow";

function AddRateForm({ cardId }: { cardId: string }) {
  const add = useAddRate();
  const [label, setLabel] = useState("");
  const [codePrefix, setCodePrefix] = useState("");
  const [unit, setUnit] = useState("m2");
  const [rate, setRate] = useState("");
  const valid = label.trim().length > 0 && unit.trim().length > 0 && parseFloat(rate) >= 0;
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-2 border-t border-gray-100 px-3 py-3">
      <Input className="h-9 text-xs" placeholder="Rate label, e.g. 225mm blockwork" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input className="h-9 text-xs" placeholder="Code prefix (F10)" value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)} />
      <Input className="h-9 text-xs" placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <Input className="h-9 text-xs" type="number" min="0" step="any" inputMode="decimal" placeholder="Rate" value={rate} onChange={(e) => setRate(e.target.value)} />
      <Button
        size="sm"
        disabled={!valid}
        loading={add.isPending}
        onClick={() =>
          add.mutate(
            { cardId, body: { label: label.trim(), descriptionPattern: label.trim(), codePrefix: codePrefix.trim() || null, unit: unit.trim(), rate: parseFloat(rate) || 0 } },
            {
              onSuccess: () => { setLabel(""); setCodePrefix(""); setRate(""); },
              onError: (e) => toast(getApiErrorMessage(e, "Could not add the rate."), "error"),
            },
          )
        }
      >
        Add rate
      </Button>
    </div>
  );
}
AddRateForm.displayName = "AddRateForm";

export function RateCardPanel({ card, canManage, onBuildUp }: Props) {
  const update = useUpdateRateCard();
  const remove = useDeleteRateCard();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{card.name}</h2>
          {card.region ? <span className="text-xs text-gray-500">{card.region}</span> : null}
          {card.isDefault ? <Badge tone="info">Default card</Badge> : null}
          <span className="text-xs text-gray-400">{card.rates.length} rates · {card.currency}</span>
        </div>
        {canManage ? (
          <div className="flex gap-1">
            {card.isDefault ? null : (
              <Button size="sm" variant="ghost" loading={update.isPending} onClick={() => update.mutate({ cardId: card.id, body: { isDefault: true } })}>
                Make default
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setConfirmOpen(true)}>
              Delete card
            </Button>
          </div>
        ) : null}
      </div>
      {card.rates.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">No rates yet. Add one below; the take-off and estimate match lines against it by unit and description.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wide text-gray-400">
              <tr><th className="px-3 py-2 font-medium">Rate</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 text-right font-medium">Figure</th><th className="px-3 py-2 font-medium">Basis</th><th /></tr>
            </thead>
            <tbody>
              {card.rates.map((rate) => (
                <RateRow key={rate.id} card={card} rate={rate} canManage={canManage} onBuildUp={onBuildUp} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage ? <AddRateForm cardId={card.id} /> : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="danger"
        title="Delete this rate card?"
        description={`${card.name} and its ${card.rates.length} rates will be removed. Estimates already priced keep their figures.`}
        confirmLabel="Delete card"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(card.id, {
            onSuccess: () => setConfirmOpen(false),
            onError: (e) => { setConfirmOpen(false); toast(getApiErrorMessage(e, "Could not delete the card."), "error"); },
          })
        }
      />
    </section>
  );
}
RateCardPanel.displayName = "RateCardPanel";
