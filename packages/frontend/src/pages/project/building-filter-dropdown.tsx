import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Building } from "@/api/buildings";

export function BuildingFilterDropdown({
  buildings,
  selectedBuildingId,
  onChange,
}: {
  buildings: Building[];
  selectedBuildingId?: string;
  onChange: (id?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (buildings.length <= 1) return null;

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const label = selectedBuilding ? `Viewing: ${selectedBuilding.name}` : "Viewing: All buildings";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg bg-white border border-[#EDEDED] px-3 text-sm font-medium text-gray-700",
          "outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          open && "bg-gray-50"
        )}
      >
        <span>{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn("size-3.5 text-gray-400 transition-transform", open && "rotate-180")}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-[#F0F0F0] bg-white p-1.5 shadow-lg">
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors text-left",
                selectedBuildingId === undefined ? "bg-blue-50 text-[#004DE7]" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <span className="flex-1 truncate">All buildings</span>
              {selectedBuildingId === undefined && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 opacity-60">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </button>
            {buildings.map((b) => {
              const isActive = b.id === selectedBuildingId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors text-left",
                    isActive ? "bg-blue-50 text-[#004DE7]" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className="flex-1 truncate">{b.name}</span>
                  {isActive && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 opacity-60">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
