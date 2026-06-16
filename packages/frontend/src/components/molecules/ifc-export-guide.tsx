import { useState } from "react";
import { cn } from "@/lib/utils";

type AuthoringTool = "revit" | "archicad" | "navisworks" | "sketchup" | "tekla";

interface ToolGuide {
  id: AuthoringTool;
  label: string;
  steps: string[];
}

const GUIDES: ToolGuide[] = [
  {
    id: "revit",
    label: "Revit",
    steps: [
      "Open your model, then go to the File menu (the big R) → Export → IFC.",
      "Set \"Current selected setup\" to IFC 2x3 Coordination View 2.0 (or IFC4 Reference View).",
      "Choose a destination folder and click Export.",
      "Upload the resulting .ifc file below.",
    ],
  },
  {
    id: "archicad",
    label: "ArchiCAD",
    steps: [
      "Go to File → Save As… and choose IFC Files (*.ifc) as the file type.",
      "Pick a translator — \"General Translator\" or \"IFC2x3 Coordination View 2.0\".",
      "Click Save to write the .ifc file.",
      "Upload the resulting .ifc file below.",
    ],
  },
  {
    id: "navisworks",
    label: "Navisworks",
    steps: [
      "Open your model, then go to Output → Export → IFC (requires the IFC exporter).",
      "If IFC export isn't available, export the original Revit model to IFC instead.",
      "Choose a destination and export.",
      "Upload the resulting .ifc file below.",
    ],
  },
  {
    id: "sketchup",
    label: "SketchUp",
    steps: [
      "Go to File → Export → 3D Model and choose IFC (*.ifc) as the format.",
      "Classify your geometry with IFC types first for best results (Entity Info → IFC).",
      "Export to a destination folder.",
      "Upload the resulting .ifc file below.",
    ],
  },
  {
    id: "tekla",
    label: "Tekla",
    steps: [
      "Go to File → Export → IFC.",
      "Choose IFC2x3 or IFC4, set the export type to Coordination View.",
      "Select the objects to include and click Export.",
      "Upload the resulting .ifc file below.",
    ],
  },
];

export function IfcExportGuide({ defaultTool }: { defaultTool?: AuthoringTool }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AuthoringTool>(defaultTool ?? "revit");
  const guide = GUIDES.find((g) => g.id === active) ?? GUIDES[0]!;

  return (
    <div className="rounded-lg border border-[#E6EDFD] bg-[#F8FAFF]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-900">
          How do I export to IFC?
        </span>
        <span className="text-xs font-medium text-[#004DE7]">
          {open ? "Hide" : "Show steps"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#E6EDFD] px-3.5 pb-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActive(g.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active === g.id
                    ? "bg-[#004DE7] text-white"
                    : "bg-white text-gray-600 hover:bg-[#EDEDED]",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          <ol className="mt-3 flex flex-col gap-2">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-600">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E6EDFD] text-[11px] font-semibold text-[#004DE7]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-xs text-gray-400">
            Revit, ArchiCAD and other BIM tools all export the open IFC format for
            free — it keeps your geometry and element data so issues stay linked.
          </p>
        </div>
      )}
    </div>
  );
}

export type { AuthoringTool };
