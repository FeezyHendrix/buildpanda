import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useCreateEstimate,
  useSendEstimate,
} from "@/hooks/use-proposals";
import { useAbility } from "@/contexts/ability-context";
import type { Estimate } from "@/api/proposals";
import { currencySymbol } from "@/lib/formatters";

import { useSeedBudgetFromEstimate } from "@/hooks/use-budget";
import { toast } from "@/lib/toast";

import { EstimateLineItems } from "./estimate-tab/line-items";
import { EstimateTotals } from "./estimate-tab/totals";
import { EstimateRevisionDrawer } from "./estimate-tab/revision-drawer";

interface Props {
  proposalId: string;
  estimate: Estimate | null;
  currency: string;
  projectId?: string | null;
}

export function EstimateTab({ proposalId, estimate, currency, projectId }: Props) {
  const ability = useAbility();
  const canCreate = ability.can("create", "proposals");
  const canUpdate = ability.can("update", "proposals");
  const canSend = ability.can("send", "proposals");

  const createEstimate = useCreateEstimate(proposalId);
  const sendEstimate = useSendEstimate(proposalId);
  const seedBudget = useSeedBudgetFromEstimate();

  const symbol = currencySymbol(currency);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);

  const isDraft = estimate?.status === "Draft";

  if (!estimate) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState
          title="No estimate yet"
          description={
            canCreate
              ? "Create the first estimate for this proposal."
              : "No estimate has been created for this proposal yet."
          }
        />
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => createEstimate.mutate({})}
            loading={createEstimate.isPending}
          >
            Create estimate
          </Button>
        )}
        {createEstimate.isError && (
          <p className="text-xs text-red-600">Failed to create estimate.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{estimate.revisionLabel}</span>
          <Badge tone={estimate.status === "Draft" ? "neutral" : estimate.status === "Accepted" ? "success" : "warning"}>
            {estimate.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {projectId && (
            <Button
              variant="secondary"
              size="sm"
              loading={seedBudget.isPending}
              onClick={async () => {
                try {
                  const items = estimate.items.map((i) => ({
                    groupLabel: i.groupLabel,
                    total: i.qty * i.unitRate,
                  }));
                  const res = await seedBudget.mutateAsync({
                    projectId,
                    items,
                    mode: "skip",
                  });
                  toast(`${res.created} categories created, ${res.skipped} skipped`, "success");
                } catch (e: any) {
                  toast(e.message || "Failed to seed budget", "error");
                }
              }}
            >
              Seed budget
            </Button>
          )}
          {estimate.status === "Draft" && canSend && (
            <Button
              variant="primary"
              size="sm"
              loading={sendEstimate.isPending}
              onClick={async () => {
                const result = await sendEstimate.mutateAsync(estimate.id);
                setShareUrl(result.shareUrl);
              }}
            >
              Send to client
            </Button>
          )}
          {estimate.status !== "Draft" && canCreate && (
            <Button variant="secondary" size="sm" onClick={() => setRevisionDrawerOpen(true)}>
              New revision
            </Button>
          )}
        </div>
      </div>

      {(shareUrl ?? estimate.shareToken) && (
        <div className="flex items-center gap-3 rounded-xl border border-[#004DE7]/20 bg-blue-50 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-[#004DE7]">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="flex-1 truncate text-xs text-[#004DE7]">
            {shareUrl ?? `${window.location.origin}/p/${estimate.shareToken}`}
          </span>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-[#004DE7] hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl ?? `${window.location.origin}/p/${estimate.shareToken ?? ""}`);
            }}
          >
            Copy link
          </button>
        </div>
      )}

      {sendEstimate.isError && (
        <p className="text-xs text-red-600">Failed to send estimate. Please try again.</p>
      )}

      <EstimateLineItems
        proposalId={proposalId}
        estimate={estimate}
        isDraft={isDraft}
        canUpdate={canUpdate}
        symbol={symbol}
      />

      <EstimateTotals
        proposalId={proposalId}
        estimate={estimate}
        isDraft={isDraft}
        canUpdate={canUpdate}
        currency={currency}
      />

      <EstimateRevisionDrawer
        proposalId={proposalId}
        open={revisionDrawerOpen}
        onOpenChange={setRevisionDrawerOpen}
      />
    </div>
  );
}
