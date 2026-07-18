import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Building } from "@/api/buildings";
import { BlocksIcon } from "@/components/atoms/project-nav-icons";

interface BuildingSwitcherProps {
  projectId: string;
  buildings: Building[];
  onClose?: () => void;
}

export function BuildingSwitcher({ projectId, buildings, onClose }: BuildingSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Determine active building from URL
  // e.g. /project/:projectId/buildings/:buildingId/...
  const buildingMatch = location.pathname.match(/\/buildings\/([^\/]+)/);
  const activeBuildingId = buildingMatch ? buildingMatch[1] : undefined;
  
  const activeBuilding = buildings.find(b => b.id === activeBuildingId) ?? buildings[0];

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
    <div ref={ref} className="relative mt-0.5 px-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60",
          open || activeBuildingId ? "text-gray-900 bg-[#EDEDED]/40" : "text-gray-500 hover:text-gray-900"
        )}
        aria-expanded={open}
      >
        <BlocksIcon className={cn("size-[18px]", (open || activeBuildingId) && "text-[#004DE7]")} />
        <span className="flex-1 truncate text-left">{activeBuilding?.name ?? "Select Building"}</span>
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
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {buildings.map((b) => {
              const isActive = b.id === activeBuilding?.id;
              return (
                <Link
                  key={b.id}
                  to={`/project/${projectId}/buildings/${b.id}/stages`}
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive ? "bg-blue-50 text-[#004DE7]" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <BlocksIcon className={cn("size-4", isActive ? "text-[#004DE7]" : "text-gray-400")} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {isActive && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 opacity-60">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
