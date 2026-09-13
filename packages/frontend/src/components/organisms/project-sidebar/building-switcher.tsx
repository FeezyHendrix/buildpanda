import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Building } from "@/api/buildings";
import { BlocksIcon } from "@/components/atoms/project-nav-icons";
import { useBuildingScope } from "@/contexts/building-scope-context";

interface BuildingSwitcherProps {
  buildings: Building[];
  onClose?: () => void;
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

  if (buildings.length <= 1) return null;

  return (
    <div ref={ref} className="relative px-3 mt-3 mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          "border border-[#F0F0F0] shadow-sm bg-white",
          "outline-none transition-all focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60",
          open ? "ring-2 ring-gray-900/10" : ""
        )}
        aria-expanded={open}
      >
        <BlocksIcon className={cn("size-[18px]", "text-[#004DE7]")} />
        <span className="flex-1 truncate text-left text-gray-900">
          {activeBuilding ? activeBuilding.name : "All buildings"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("size-3.5 text-gray-400 transition-transform", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-[#F0F0F0] bg-white p-1.5 shadow-lg">
          <div className="max-h-60 overflow-y-auto space-y-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setSelectedBuildingId(undefined);
                setOpen(false);
                onClose?.();
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors",
                !selectedBuildingId ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-[#EDEDED]/40 hover:text-gray-900"
              )}
            >
              All buildings
              {!selectedBuildingId && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            {buildings.map((b) => {
              const isActive = b.id === activeBuilding?.id;
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => {
                    setSelectedBuildingId(b.id);
                    setOpen(false);
                    onClose?.();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors",
                    isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-[#EDEDED]/40 hover:text-gray-900"
                  )}
                >
                  <span className="truncate">{b.name}</span>
                  {isActive && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3.5">
                      <polyline points="20 6 9 17 4 12" />
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
