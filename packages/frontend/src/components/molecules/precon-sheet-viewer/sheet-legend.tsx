import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementStyle } from "./element-styles";

interface Props {
  styles: ElementStyle[];
}

/** Floating legend of the element colours present on the active sheet. */
export function SheetLegend({ styles }: Props) {
  const [open, setOpen] = useState(true);
  if (styles.length === 0) return null;
  return (
    <div
      className="absolute bottom-3 left-3 flex flex-col rounded-lg border border-gray-200 bg-white/95 shadow-sm backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase text-gray-500 hover:text-gray-700"
      >
        Legend
        <ChevronDown className={cn("ml-2 size-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto border-t border-gray-100 p-2">
          {styles.map((st) => (
            <div key={st.label} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: st.color }} />
              <span className="text-[11px] text-gray-700">{st.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
SheetLegend.displayName = "SheetLegend";
