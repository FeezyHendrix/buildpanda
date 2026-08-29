import { AlertIcon, CheckIcon, DocumentsIcon } from "@/components/atoms/project-nav-icons";
import { formatCurrency } from "@/lib/formatters";
import type { ExtractedInvoice } from "@/hooks/use-invoices";
import { cn } from "@/lib/utils";

/**
 * Shows what the AI read off a scanned document, so the user can check it
 * against the pre-filled form before sending. Purely informational.
 */
export function ScannedDetailsBanner({ draft, currency }: { draft: ExtractedInvoice; currency: string }) {
  const isWarning = draft.documentKind !== "invoice" || draft.confidence === "low";

  return (
    <div className={cn("rounded-xl border p-4", isWarning ? "border-amber-200 bg-amber-50" : "border-[#E4E9F5] bg-[#F5F8FF]")}>
      <div className="flex gap-3">
        {isWarning ? (
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-amber-600" />
        ) : (
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-[#004DE7]" />
        )}
        <div>
          <h3 className={cn("text-sm font-semibold", isWarning ? "text-amber-900" : "text-[#004DE7]")}>
            {isWarning
              ? "This document may not be a clean invoice"
              : "We pre-filled the form from your scan — check it before sending."}
          </h3>
          {isWarning && (
            <p className="mt-1 max-w-3xl text-sm text-amber-700">
              The AI detected this as a {draft.documentKind} with {draft.confidence} confidence. Please check every field carefully against the original document.
            </p>
          )}

          <div className="mt-4 rounded-lg border border-white/40 bg-white/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <DocumentsIcon className="size-4" />
              Document says
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.vendorName && <Chip label="Vendor" value={draft.vendorName} />}
              {draft.invoiceNumber && <Chip label="Invoice #" value={draft.invoiceNumber} />}
              {draft.issueDate && <Chip label="Issue date" value={draft.issueDate} />}
              {draft.dueDate && <Chip label="Due date" value={draft.dueDate} />}
              {draft.currency && <Chip label="Currency" value={draft.currency} />}
              {draft.subtotal !== null && <Chip label="Subtotal" value={formatCurrency(draft.subtotal, currency)} />}
              {draft.vatAmount !== null && <Chip label="VAT" value={formatCurrency(draft.vatAmount, currency)} />}
              {draft.total !== null && <Chip label="Total" value={formatCurrency(draft.total, currency)} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ScannedDetailsBanner.displayName = "ScannedDetailsBanner";

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm ring-1 ring-gray-900/5">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
