import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import { IfcExportGuide, type AuthoringTool } from "./ifc-export-guide";
import { useUploadBimModel } from "@/hooks/use-bim";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

const NATIVE_EXT_TOOL: { pattern: RegExp; tool: AuthoringTool; label: string }[] = [
  { pattern: /\.rvt$/i, tool: "revit", label: "Revit" },
  { pattern: /\.(pln|pla)$/i, tool: "archicad", label: "ArchiCAD" },
  { pattern: /\.(nwd|nwc)$/i, tool: "navisworks", label: "Navisworks" },
  { pattern: /\.skp$/i, tool: "sketchup", label: "SketchUp" },
];

function detectNativeTool(fileName: string): { tool: AuthoringTool; label: string } | null {
  const match = NATIVE_EXT_TOOL.find((n) => n.pattern.test(fileName));
  return match ? { tool: match.tool, label: match.label } : null;
}

export function UploadBimDialog({ open, onOpenChange, projectId }: Props) {
  const upload = useUploadBimModel();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDiscipline("");
      setFile(null);
    }
  }, [open]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>): void {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    if (picked && name.trim() === "") {
      setName(picked.name.replace(/\.ifc$/i, ""));
    }
  }

  function submit(): void {
    if (!file || name.trim() === "") return;
    upload.mutate(
      { projectId, name, discipline: discipline || null, file },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const isIfc = file ? /\.ifc$/i.test(file.name) : true;
  const nativeTool = file && !isIfc ? detectNativeTool(file.name) : null;
  const canSubmit = Boolean(file) && isIfc && name.trim() !== "";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Import a 3D model"
      description="Bring in your Revit, ArchiCAD, Navisworks or other BIM model by exporting it to IFC, the open format every major tool supports."
      submitLabel="Upload model"
      onSubmit={submit}
      submitting={upload.isPending}
      submitDisabled={!canSubmit}
      error={upload.error instanceof Error ? upload.error.message : null}
    >
      <IfcExportGuide defaultTool={nativeTool?.tool} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bim-file">IFC file</Label>
        <input
          id="bim-file"
          ref={fileRef}
          type="file"
          accept=".ifc,.rvt,.pln,.pla,.nwd,.nwc,.skp"
          onChange={onPick}
          className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDEDED] file:px-3 file:py-2 file:text-sm"
        />
        {file && !isIfc && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-800">
              {nativeTool
                ? `That looks like a ${nativeTool.label} file, we can't read it directly.`
                : "Only .ifc files are supported."}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {nativeTool
                ? `Export it to IFC from ${nativeTool.label} first (see the steps above), then upload the .ifc file.`
                : "Export your model to IFC first, then upload the .ifc file."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bim-name">Model name</Label>
        <input
          id="bim-name"
          className={field}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Architectural Model"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bim-discipline">Discipline (optional)</Label>
        <input
          id="bim-discipline"
          className={field}
          value={discipline}
          maxLength={80}
          onChange={(e) => setDiscipline(e.target.value)}
          placeholder="e.g. Architecture, Structure, MEP"
        />
      </div>

      {upload.isPending && (
        <p className="text-xs text-gray-500">
          Uploading and processing… large models may take a moment.
        </p>
      )}
    </FormDrawer>
  );
}

UploadBimDialog.displayName = "UploadBimDialog";
