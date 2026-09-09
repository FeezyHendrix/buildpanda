import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { AssembliesPanel } from "@/components/molecules/rate-library/assemblies-panel";
import { RateBuildupDrawer } from "@/components/molecules/rate-library/rate-buildup-drawer";
import { RateCardPanel } from "@/components/molecules/rate-library/rate-card-panel";
import { QuoteSourcesPanel } from "@/components/molecules/rate-library/quote-sources-panel";
import type { Rate } from "@/api/rate-library";
import { useAbility } from "@/contexts/ability-context";
import { useCreateRateCard, useRateCards } from "@/hooks/use-rate-library";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// WS-M3B: rates and assemblies share the page; assemblies price from the cards.
const TABS = [
  { id: "rates", label: "Rate cards" },
  { id: "assemblies", label: "Assemblies" },
] as const;
type LibraryTab = (typeof TABS)[number]["id"];

function NewCardForm() {
  const create = useCreateRateCard();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
      <div className="min-w-56 flex-1">
        <label className="text-xs font-medium text-gray-600" htmlFor="rate-card-name">New rate card</label>
        <Input id="rate-card-name" className="mt-1 h-9 text-sm" placeholder="e.g. Lagos residential 2026" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-40">
        <label className="text-xs font-medium text-gray-600" htmlFor="rate-card-region">Region</label>
        <Input id="rate-card-region" className="mt-1 h-9 text-sm" placeholder="Lagos" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={name.trim().length === 0}
        loading={create.isPending}
        onClick={() =>
          create.mutate(
            { name: name.trim(), region: region.trim() || null },
            { onSuccess: () => { setName(""); setRegion(""); }, onError: (e) => toast(getApiErrorMessage(e, "Could not create the card."), "error") },
          )
        }
      >
        Create card
      </Button>
    </div>
  );
}
NewCardForm.displayName = "NewCardForm";

export default function RateLibraryPage() {
  const ability = useAbility();
  const canManage = ability.can("manage", "rateCards");
  const { data: cards = [], isPending, isError } = useRateCards();
  const [buildUp, setBuildUp] = useState<{ cardId: string; currency: string; rate: Rate } | null>(null);
  const [tab, setTab] = useState<LibraryTab>("rates");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link to="/sales/settings" className="text-xs font-medium text-primary-600 hover:underline">← Settings</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Rate library</h1>
        <p className="mt-1 text-sm text-gray-500">
          The rates your estimates price against. Build a rate up from labour, materials and plant, or back it with a supplier quote.
          The default card is what "Fill rates from library" and Panda AI pricing use.
        </p>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "border-b-2 border-primary-500 text-primary-600" : "text-gray-500 hover:text-gray-700",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "assemblies" ? <AssembliesPanel cards={cards} canManage={canManage} /> : null}
      {tab === "rates" && canManage ? <NewCardForm /> : null}

      {tab !== "rates" ? null : isPending ? (
        <div className="flex justify-center py-10"><Spinner size="sm" /></div>
      ) : isError ? (
        <EmptyState title="Could not load the rate library" description="Refresh the page to try again." />
      ) : cards.length === 0 ? (
        <EmptyState title="No rate cards yet" description="Create a card above, then add the rates you price with most. One card is enough to start." />
      ) : (
        cards.map((card) => (
          <RateCardPanel
            key={card.id}
            card={card}
            canManage={canManage}
            onBuildUp={(rate) => setBuildUp({ cardId: card.id, currency: card.currency, rate })}
          />
        ))
      )}

      {isPending || tab !== "rates" ? null : <QuoteSourcesPanel cards={cards} canManage={canManage} />}

      <RateBuildupDrawer
        open={buildUp !== null}
        onOpenChange={(open) => { if (!open) setBuildUp(null); }}
        cardId={buildUp?.cardId ?? ""}
        currency={buildUp?.currency ?? "NGN"}
        rate={buildUp?.rate ?? null}
      />
    </div>
  );
}
