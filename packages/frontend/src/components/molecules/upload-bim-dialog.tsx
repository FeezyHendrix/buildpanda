import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import { useUploadBimModel } from "@/hooks/use-bim";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

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
  const canSubmit = Boolean(file) && isIfc && name.trim() !== "";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Upload an IFC model"
      description="Export your Revit or Navisworks model to IFC, then upload it here. Large files upload in parallel."
      submitLabel="Upload model"
      onSubmit={submit}
      submitting={upload.isPending}
      submitDisabled={!canSubmit}
      error={upload.error instanceof Error ? upload.error.message : null}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bim-file">IFC file</Label>
        <input
          id="bim-file"
          ref={fileRef}
          type="file"
          accept=".ifc"
          onChange={onPick}
          className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDEDED] file:px-3 file:py-2 file:text-sm"
        />
        {file && !isIfc && (
          <p className="text-xs text-red-600">Only .ifc files are supported. Export to IFC first.</p>
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
