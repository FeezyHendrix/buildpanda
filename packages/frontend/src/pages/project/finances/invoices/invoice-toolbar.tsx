import { Download } from "lucide-react";
import { SearchInput } from "@/components/atoms/search-input";
import { Select } from "@/components/atoms/select";
import { DateFilterPopover } from "@/components/molecules/date-filter-popover";
import { INVOICE_STATUSES, invoiceStatusLabel, type InvoiceStatusFilter } from "./invoice-model";

const ALL = "all";
const STATUS_OPTIONS = [{ value: ALL, label: "All statuses" }, ...INVOICE_STATUSES.map((status) => ({ value: status, label: invoiceStatusLabel(status) }))];

interface InvoiceToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: InvoiceStatusFilter;
  onStatusChange: (status: InvoiceStatusFilter) => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onExport: () => void;
  canExport: boolean;
}

/** Search on the left; issue-date range, status and a CSV download on the right. */
export function InvoiceToolbar({ search, onSearchChange, status, onStatusChange, dateFrom, dateTo, onDateChange, onExport, canExport }: InvoiceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[8px]">
      <div className="w-full border border-[#EEEEEE] bg-white sm:max-w-[396px]">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Invoices"
          aria-label="Search invoices"
          className="h-[34px] rounded-none pl-[44px] text-caption-l placeholder:text-[#A3A3A3] lg:text-caption-l"
        />
      </div>
      <div className="flex items-center gap-[8px]">
        <DateFilterPopover
          dateFrom={dateFrom}
          dateTo={dateTo}
          onApply={onDateChange}
          triggerClassName="h-[36px] gap-[10px] border-[#EEEEEE] px-[7px] text-[14px] font-medium"
        />
        <div className="w-[84px]">
          <Select
            options={STATUS_OPTIONS}
            value={status === ALL ? null : status}
            onChange={(next) => onStatusChange((next && next !== ALL ? next : ALL) as InvoiceStatusFilter)}
            placeholder="Status"
            className="h-[36px] border-[#EEEEEE] px-[8px] text-[14px] font-medium"
            iconClassName="size-4 text-[#1E1E1E]"
            popupClassName="min-w-[190px]"
          />
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          aria-label="Download invoices as CSV"
          className="flex size-[36px] items-center justify-center bg-[#004DE7] text-white outline-none transition-colors hover:bg-[#003FC0] focus-visible:ring-2 focus-visible:ring-[#004DE7]/30 disabled:opacity-50"
        >
          <Download className="size-[14px]" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
}

InvoiceToolbar.displayName = "InvoiceToolbar";
