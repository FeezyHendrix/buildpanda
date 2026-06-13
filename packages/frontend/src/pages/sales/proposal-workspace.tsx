import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useProposalWorkspace,
  useCreateEstimate,
  usePatchEstimate,
  useSendEstimate,
  useProposalComments,
  usePostComment,
} from "@/hooks/use-proposals";
import type { Estimate, ProposalStatus } from "@/api/proposals";
import { proposalsApi } from "@/api/proposals";
import { cn } from "@/lib/utils";

type Tab = "overview" | "estimate" | "messages";

const STATUS_TONE: Record<
  ProposalStatus,
  "neutral" | "info" | "warning" | "success" | "danger" | "accent"
> = {
  New: "info",
  Preparing: "accent",
  Sent: "warning",
  UnderReview: "warning",
  Revising: "accent",
  Accepted: "success",
  Converted: "success",
  Lost: "danger",
  Expired: "neutral",
};

const LABEL_MAP: Record<ProposalStatus, string> = {
  New: "New",
  Preparing: "Preparing",
  Sent: "Sent",
  UnderReview: "Under Review",
  Revising: "Revising",
  Accepted: "Accepted",
  Converted: "Converted",
  Lost: "Lost",
  Expired: "Expired",
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function OverviewTab({ proposalId }: { proposalId: string }) {
  const { data } = useProposalWorkspace(proposalId);
  if (!data) return null;
  const { proposal, events } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Client
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{proposal.clientName}</dd>
            </div>
            {proposal.clientEmail && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700">{proposal.clientEmail}</dd>
              </div>
            )}
            {proposal.clientPhone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-700">{proposal.clientPhone}</dd>
              </div>
            )}
            {proposal.location && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Location</dt>
                <dd className="text-gray-700">{proposal.location}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Proposal
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Number</dt>
              <dd className="font-mono text-xs font-medium text-gray-700">{proposal.numberLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Currency</dt>
              <dd className="text-gray-700">{proposal.currency}</dd>
            </div>
            {proposal.validUntil && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Valid until</dt>
                <dd className="text-gray-700">
                  {new Date(proposal.validUntil).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-700">
                {new Date(proposal.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {proposal.brief && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Brief
          </h3>
          <p className="whitespace-pre-line text-sm text-gray-700">{proposal.brief}</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Activity
          </h3>
          <ol className="flex flex-col gap-3">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-gray-300 mt-2" />
                <div>
                  <span className="capitalize text-gray-700">{ev.type.replace(/_/g, " ")}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(ev.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

interface ItemDraft {
  groupLabel: string;
  description: string;
  qty: string;
  unit: string;
  unitRate: string;
  sort: number;
}

function itemsToApi(items: ItemDraft[]) {
  return items.map((item, i) => ({
    groupLabel: item.groupLabel,
    description: item.description,
    qty: parseFloat(item.qty) || 0,
    unit: item.unit,
    unitRate: parseFloat(item.unitRate) || 0,
    boqItemId: null,
    sort: i,
  }));
}

function MessagesTab({ proposalId }: { proposalId: string }) {
  const { data: comments = [], isLoading } = useProposalComments(proposalId);
  const postComment = usePostComment(proposalId);
  const [body, setBody] = useState("");

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    await postComment.mutateAsync(trimmed);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="size-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState title="No messages yet" description="Leave an internal note or message for your team." />
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">{c.authorName}</span>
                <span className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-700">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note or message…"
          className={cn(
            "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
            "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            "resize-none placeholder:text-gray-400",
          )}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!body.trim() || postComment.isPending}
          >
            {postComment.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EstimateTab({
  proposalId,
  estimate,
  currency,
}: {
  proposalId: string;
  estimate: Estimate | null;
  currency: string;
}) {
  const createEstimate = useCreateEstimate(proposalId);
  const patchEstimate = usePatchEstimate(proposalId);
  const sendEstimate = useSendEstimate(proposalId);

  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const [items, setItems] = useState<ItemDraft[]>(() =>
    (estimate?.items ?? []).map((item) => ({
      groupLabel: item.groupLabel,
      description: item.description,
      qty: String(item.qty),
      unit: item.unit,
      unitRate: String(item.unitRate),
      sort: item.sort,
    })),
  );
  const [savingItems, setSavingItems] = useState(false);
  const [saveItemsError, setSaveItemsError] = useState<string | null>(null);

  const [contingencyPct, setContingencyPct] = useState(
    String(estimate?.contingencyPct ?? 0),
  );
  const [taxLabel, setTaxLabel] = useState(estimate?.taxLabel ?? "VAT");
  const [taxPct, setTaxPct] = useState(String(estimate?.taxPct ?? 0));

  const isDraft = estimate?.status === "Draft";

  async function handleCreateRevision() {
    if (!changeNote.trim() && estimate) return;
    await createEstimate.mutateAsync({ changeNote: changeNote.trim() || undefined });
    setRevisionDrawerOpen(false);
    setChangeNote("");
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { groupLabel: "", description: "", qty: "1", unit: "item", unitRate: "0", sort: prev.length },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem<K extends keyof ItemDraft>(index: number, key: K, value: ItemDraft[K]) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  async function saveItems() {
    if (!estimate) return;
    setSavingItems(true);
    setSaveItemsError(null);
    try {
      await proposalsApi.replaceItems(proposalId, estimate.id, itemsToApi(items));
    } catch {
      setSaveItemsError("Failed to save items.");
    } finally {
      setSavingItems(false);
    }
  }

  async function saveTotals() {
    if (!estimate) return;
    await patchEstimate.mutateAsync({
      estimateId: estimate.id,
      contingencyPct: parseFloat(contingencyPct) || 0,
      taxLabel: taxLabel.trim(),
      taxPct: parseFloat(taxPct) || 0,
    });
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState
          title="No estimate yet"
          description="Create the first estimate for this proposal."
        />
        <Button
          variant="primary"
          onClick={() => createEstimate.mutate({})}
          disabled={createEstimate.isPending}
        >
          {createEstimate.isPending ? "Creating…" : "Create estimate"}
        </Button>
        {createEstimate.isError && (
          <p className="text-xs text-red-600">Failed to create estimate.</p>
        )}
      </div>
    );
  }

  const rowClass = cn(
    "grid grid-cols-[2fr_3fr_1fr_1.5fr_1.5fr_auto] gap-2 items-start",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{estimate.revisionLabel}</span>
          <Badge tone={estimate.status === "Draft" ? "neutral" : estimate.status === "Accepted" ? "success" : "warning"}>
            {estimate.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {estimate.status === "Draft" && (
            <Button
              variant="primary"
              size="sm"
              disabled={sendEstimate.isPending}
              onClick={async () => {
                const result = await sendEstimate.mutateAsync(estimate.id);
                setShareUrl(result.shareUrl);
              }}
            >
              {sendEstimate.isPending ? "Sending…" : "Send to client"}
            </Button>
          )}
          {estimate.status !== "Draft" && (
            <Button variant="secondary" size="sm" onClick={() => setRevisionDrawerOpen(true)}>
              New revision
            </Button>
          )}
        </div>
      </div>

      {/* Share link banner */}
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

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Line items
          </h3>
        </div>
        <div className="p-4">
          {items.length > 0 && (
            <div className={cn(rowClass, "mb-2")}>
              {["Group", "Description", "Qty", "Unit", "Rate"].map((h) => (
                <span key={h} className="text-xs font-semibold text-gray-400">
                  {h}
                </span>
              ))}
              <span />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className={rowClass}>
                <Input
                  className="h-9 text-xs"
                  value={item.groupLabel}
                  onChange={(e) => updateItem(i, "groupLabel", e.target.value)}
                  placeholder="Group"
                  disabled={!isDraft}
                />
                <Input
                  className="h-9 text-xs"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                  placeholder="Description"
                  disabled={!isDraft}
                />
                <Input
                  className="h-9 text-xs"
                  type="number"
                  min="0"
                  value={item.qty}
                  onChange={(e) => updateItem(i, "qty", e.target.value)}
                  disabled={!isDraft}
                />
                <Input
                  className="h-9 text-xs"
                  value={item.unit}
                  onChange={(e) => updateItem(i, "unit", e.target.value)}
                  placeholder="m², item…"
                  disabled={!isDraft}
                />
                <Input
                  className="h-9 text-xs"
                  type="number"
                  min="0"
                  value={item.unitRate}
                  onChange={(e) => updateItem(i, "unitRate", e.target.value)}
                  disabled={!isDraft}
                />
                {isDraft ? (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="flex h-9 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                ) : (
                  <span className="w-8" />
                )}
              </div>
            ))}
          </div>

          {isDraft && (
            <div className="mt-3 flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={addItem}>
                + Add line
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveItems}
                disabled={savingItems}
              >
                {savingItems ? "Saving…" : "Save items"}
              </Button>
              {saveItemsError && (
                <span className="text-xs text-red-600">{saveItemsError}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Totals / tax settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Totals
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Contingency (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={contingencyPct}
                onChange={(e) => setContingencyPct(e.target.value)}
                disabled={!isDraft}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tax label</Label>
                <Input
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="VAT"
                  disabled={!isDraft}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tax rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  disabled={!isDraft}
                />
              </div>
            </div>
            {isDraft && (
              <Button
                variant="secondary"
                size="sm"
                onClick={saveTotals}
                disabled={patchEstimate.isPending}
                className="self-start"
              >
                {patchEstimate.isPending ? "Updating…" : "Update totals"}
              </Button>
            )}
          </div>

          <div className="flex-1 rounded-xl bg-gray-50 p-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium">{fmt(estimate.subtotal, currency)}</dd>
              </div>
              {estimate.contingencyPct > 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <dt>Contingency ({estimate.contingencyPct}%)</dt>
                  <dd>{fmt(estimate.subtotal * estimate.contingencyPct / 100, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">{estimate.taxLabel} ({estimate.taxPct}%)</dt>
                <dd className="font-medium">{fmt(estimate.taxAmount, currency)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-semibold text-gray-900">{fmt(estimate.total, currency)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* New revision drawer */}
      <FormDrawer
        open={revisionDrawerOpen}
        onOpenChange={setRevisionDrawerOpen}
        title="New estimate revision"
        description="This will supersede the previous sent estimate. A change note is required."
        submitLabel="Create revision"
        submitDisabled={!changeNote.trim()}
        submitting={createEstimate.isPending}
        error={createEstimate.isError ? "Failed to create revision." : null}
        onSubmit={handleCreateRevision}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="change-note">Change note *</Label>
          <textarea
            id="change-note"
            rows={4}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Describe what changed in this revision…"
            className={cn(
              "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
              "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
              "resize-none placeholder:text-gray-400",
            )}
          />
        </div>
      </FormDrawer>
    </div>
  );
}

export default function ProposalWorkspace() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading, isError } = useProposalWorkspace(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-7 animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <EmptyState
          title="Proposal not found"
          description="This proposal may have been deleted or you don't have access."
        />
        <Button variant="secondary" onClick={() => navigate("/sales/proposals")} className="mt-4">
          Back to proposals
        </Button>
      </div>
    );
  }

  const { proposal, estimate } = data;

  const tabClass = (t: Tab) =>
    cn(
      "px-4 py-2 text-sm font-medium transition-colors",
      tab === t
        ? "border-b-2 border-[#004DE7] text-[#004DE7]"
        : "text-gray-500 hover:text-gray-700",
    );

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link to="/sales/proposals" className="hover:text-gray-600">
            Proposals
          </Link>
          <span>/</span>
          <span className="font-mono">{proposal.numberLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{proposal.title}</h1>
            <Badge tone={STATUS_TONE[proposal.status] ?? "neutral"}>
              {LABEL_MAP[proposal.status] ?? proposal.status}
            </Badge>
          </div>
          {estimate && (
            <span className="text-sm font-semibold text-gray-700">
              {fmt(estimate.total, proposal.currency)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{proposal.clientName}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 px-6">
        <button type="button" className={tabClass("overview")} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button type="button" className={tabClass("estimate")} onClick={() => setTab("estimate")}>
          Estimate
          {estimate && (
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {estimate.revisionLabel}
            </span>
          )}
        </button>
        <button type="button" className={tabClass("messages")} onClick={() => setTab("messages")}>
          Messages
        </button>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === "overview" && <OverviewTab proposalId={id} />}
        {tab === "estimate" && (
          <EstimateTab proposalId={id} estimate={estimate} currency={proposal.currency} />
        )}
        {tab === "messages" && <MessagesTab proposalId={id} />}
      </div>
    </div>
  );
}
