import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Building } from "@/api/buildings";
import { BlocksIcon } from "@/components/atoms/project-nav-icons";
import { useBuildingScope } from "@/contexts/building-scope-context";

interface BuildingSwitcherProps {
  buildings: Building[];
  onClose?: () => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-primary-500">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Building scope picker in the dark sidebar; the list opens as a light menu under it. */
export function BuildingSwitcher({ buildings, onClose }: BuildingSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { selectedBuildingId, setSelectedBuildingId } = useBuildingScope();
  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (buildings.length <= 1) return null;

  const choose = (id: string | undefined) => {
    setSelectedBuildingId(id);
    setOpen(false);
    onClose?.();
  };
  const optionClass = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-ink outline-none transition-colors hover:bg-black/5",
      active && "bg-black/5 font-medium",
    );

  return (
    <div ref={ref} className="relative px-4 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-left text-sm text-ink-inverted outline-none transition-colors hover:bg-white/30 focus-visible:bg-white/30"
      >
        <BlocksIcon className="size-[18px] shrink-0 text-ink-disabled" />
        <span className="flex-1 truncate">{activeBuilding ? activeBuilding.name : "All buildings"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("size-4 text-ink-disabled transition-transform", open && "rotate-180")}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg border border-line bg-white p-2 shadow-card">
          <div className="max-h-60 overflow-y-auto no-scrollbar">
            <button type="button" onClick={() => choose(undefined)} className={optionClass(!selectedBuildingId)}>
              All buildings
              {!selectedBuildingId && <CheckIcon />}
            </button>
            {buildings.map((b) => {
              const isActive = b.id === activeBuilding?.id;
              return (
                <button type="button" key={b.id} onClick={() => choose(b.id)} className={optionClass(isActive)}>
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
BuildingSwitcher.displayName = "BuildingSwitcher";
