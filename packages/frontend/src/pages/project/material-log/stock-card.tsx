import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { cn } from "@/lib/utils";
import type { StockLevel } from "@/lib/project-types";

function initials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function BoxIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function DownloadIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function TrendingUpIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function BellIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ClipboardCheckIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function StackIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 18l9 5 9-5" />
    </svg>
  );
}

function formatQty(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pluralUnit(unit: string, count: number): string {
  const u = (unit || "unit").trim();
  if (count === 1) return u;
  if (/^m3$/i.test(u)) return "m³";
  if (/^m2$/i.test(u)) return "m²";
  if (/[0-9³²]$/.test(u)) return u;
  if (/(s|x|z|ch|sh)$/i.test(u)) return u + "es";
  return u + "s";
}

export function StockCard({
  stock,
  canManage,
  onEditPolicy,
}: {
  stock: StockLevel;
  canManage?: boolean;
  onEditPolicy?: () => void;
}) {
  const onHand = stock.onHandQty;
  const negative = onHand < 0;
  const inHandUnit = pluralUnit(stock.unit, onHand);
  const receivedUnit = pluralUnit(stock.unit, stock.totalReceived);
  const usedUnit = pluralUnit(stock.unit, stock.totalUsed);
  const thresholdSet = stock.lowStockThreshold !== null;
  const thresholdUnit = thresholdSet
    ? pluralUnit(stock.unit, stock.lowStockThreshold!)
    : stock.unit;

  const inHandToneText = negative ? "text-rose-700" : "text-teal-800";
  const inHandToneBg = negative ? "bg-rose-50" : "bg-teal-50";
  const inHandToneBorder = negative ? "border-rose-200" : "border-teal-200";
  const inHandIconTint = negative ? "border-rose-500 text-rose-600" : "border-teal-500 text-teal-600";

  return (
    <Card
      padding="none"
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">
          {initials(stock.materialName)}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-bold leading-snug text-slate-900 text-balance"
            title={stock.materialName}
          >
            {stock.materialName}
          </h3>
          <div className="mt-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            Unit: {stock.unit}
          </div>
        </div>
        <div className="flex-none text-slate-700">
          <StackIcon className="h-6 w-6" />
        </div>
      </div>

      <div
        className={cn(
          "mx-3.5 flex items-center gap-3 rounded-lg border p-3",
          inHandToneBg,
          inHandToneBorder,
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 bg-white",
            inHandIconTint,
          )}
        >
          <BoxIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-bold uppercase tracking-wider", inHandToneText)}>
            Total in hand
          </p>
          <p className={cn("mt-0.5 flex flex-wrap items-baseline gap-x-1 text-2xl font-extrabold leading-none tabular-nums", inHandToneText)}>
            <span>{formatQty(onHand)}</span>
            <span className="text-sm font-semibold">{inHandUnit}</span>
          </p>
        </div>
        <div
          className={cn(
            "hidden text-xs 2xl:block 2xl:border-l 2xl:pl-6",
            negative ? "border-rose-300 text-rose-700" : "border-teal-300 text-slate-500",
          )}
        >
          Total in hand ={" "}
          <span className="whitespace-nowrap">Total Received – Total Used</span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 px-3.5">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 p-2.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-emerald-500 bg-white text-emerald-600">
            <DownloadIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              Total received
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 text-base font-extrabold leading-tight tabular-nums text-emerald-800">
              <span>{formatQty(stock.totalReceived)}</span>
              <span className="text-[11px] font-semibold">{receivedUnit}</span>
            </p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-blue-500 bg-white text-blue-600">
            <TrendingUpIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">
              Total used
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 text-base font-extrabold leading-tight tabular-nums text-blue-800">
              <span>{formatQty(stock.totalUsed)}</span>
              <span className="text-[11px] font-semibold">{usedUnit}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <BellIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">
              Reorder policy
            </p>
            {thresholdSet ? (
              <p className="mt-0.5 text-xs text-slate-700">
                Reorder when less than{" "}
                <span className="ml-0.5 inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 tabular-nums">
                  {formatQty(stock.lowStockThreshold!)} {thresholdUnit}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs italic text-slate-500">
                No reorder threshold set.
              </p>
            )}
          </div>
          {canManage && onEditPolicy && (
            <button
              type="button"
              onClick={onEditPolicy}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-violet-700 hover:bg-violet-50"
              title={thresholdSet ? "Edit reorder policy" : "Set reorder policy"}
              aria-label={thresholdSet ? "Edit reorder policy" : "Set reorder policy"}
            >
              <ClipboardCheckIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="px-3.5 pb-2.5 text-[10px] italic text-slate-400">
        Total in hand = Total Received – Total Used
      </p>

      {negative && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-2">
          <Badge tone="danger" size="sm">
            Negative stock — check ledger
          </Badge>
        </div>
      )}
    </Card>
  );
}
