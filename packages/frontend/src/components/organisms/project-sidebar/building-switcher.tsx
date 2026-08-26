import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Building } from "@/api/buildings";
import { useBuildingScope } from "@/contexts/building-scope-context";

interface BuildingSwitcherProps {
  buildings: Building[];
  onClose?: () => void;
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 text-gray-400"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5 shrink-0 text-primary-500">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function BuildingSwitcher({ buildings, onClose }: BuildingSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { selectedBuildingId, setSelectedBuildingId } = useBuildingScope();
  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (buildings.length === 0) return null;

  const canSwitch = buildings.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen(v => !v)}
        aria-expanded={canSwitch ? open : undefined}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2.5 text-sm text-[#1E1E1E]",
          "border border-[#EBEBEB] bg-white outline-none transition-colors",
          canSwitch ? "cursor-pointer hover:border-gray-300" : "cursor-default",
          open && "border-gray-400",
        )}
      >
        <span className="flex-1 truncate text-left font-medium">
          {activeBuilding ? activeBuilding.name : buildings[0]?.name ?? "All buildings"}
        </span>
        {canSwitch && (
          <span className={cn("transition-transform", open && "rotate-180")}>
            <ChevronDown />
          </span>
        )}
      </button>

      {open && canSwitch && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 border border-[#EBEBEB] bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto p-1 no-scrollbar">
            <button
              type="button"
              onClick={() => { setSelectedBuildingId(undefined); setOpen(false); onClose?.(); }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-sm font-medium outline-none transition-colors",
                !selectedBuildingId
                  ? "bg-primary-50 text-primary-500"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              All buildings
              {!selectedBuildingId && <CheckIcon />}
            </button>

            {buildings.map(b => {
              const isActive = b.id === selectedBuildingId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setSelectedBuildingId(b.id); setOpen(false); onClose?.(); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-sm font-medium outline-none transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-500"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <span className="truncate">{b.name}</span>
                  {isActive && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
