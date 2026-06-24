import { useEffect, useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { uploadFileRequest } from "@/hooks/use-files";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function LogMaterialDrawer({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (input: {
    entryType: "IN" | "USED";
    materialName: string;
    unit: string;
    quantity: number;
    fileIds?: string[];
    notesHtml?: string | null;
  }) => void;
}) {
  const [entryType, setEntryType] = useState<"IN" | "USED">("IN");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("bags");
  const [quantity, setQuantity] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notesHtml, setNotesHtml] = useState("");

  function reset(): void {
    setEntryType("IN");
    setMaterialName("");
    setUnit("bags");
    setQuantity("");
    setFileId(null);
    setFileName(null);
    setNotesHtml("");
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFileRequest(file);
      setFileId(uploaded.id);
      setFileName(uploaded.fileName);
    } catch {
      toast("Could not upload photo");
    } finally {
      setUploading(false);
    }
  }

  const qtyNum = Number(quantity);
  const valid = materialName.trim().length > 0 && unit.trim().length > 0 && qtyNum > 0;

  function handleSubmit(): void {
    if (!valid) return;
    onSubmit({
      entryType,
      materialName: materialName.trim(),
      unit: unit.trim(),
      quantity: qtyNum,
      fileIds: fileId ? [fileId] : [],
      notesHtml: notesHtml.trim().length > 0 ? notesHtml : null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title="Log material"
      submitLabel="Log entry"
      submitDisabled={!valid || uploading}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEntryType("IN")}
          className={cn(
            "h-11 flex-1 rounded-lg text-sm font-semibold transition-colors",
            entryType === "IN" ? "bg-green-600 text-white" : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
          )}
        >
          Received (IN)
        </button>
        <button
          type="button"
          onClick={() => setEntryType("USED")}
          className={cn(
            "h-11 flex-1 rounded-lg text-sm font-semibold transition-colors",
            entryType === "USED" ? "bg-amber-600 text-white" : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
          )}
        >
          Used
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-name">Material</Label>
        <input
          id="mat-name"
          value={materialName}
          onChange={(e) => setMaterialName(e.target.value)}
          placeholder="e.g. Cement"
          className={FIELD}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="mat-qty">Quantity</Label>
          <MoneyInput
            id="mat-qty"
            value={quantity}
            onChange={setQuantity}
            placeholder="0"
            className={FIELD}
          />
        </div>
        <div className="flex w-32 flex-col gap-1.5">
          <Label htmlFor="mat-unit">Unit</Label>
          <input
            id="mat-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="bags"
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-photo">Photo proof (optional)</Label>
        {fileId ? (
          <div className="flex items-center justify-between rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-700">
            <span className="truncate">{fileName}</span>
            <button type="button" onClick={() => { setFileId(null); setFileName(null); }} className="text-gray-400 hover:text-red-500">
              Remove
            </button>
          </div>
        ) : (
          <label className={cn(FIELD, "flex cursor-pointer items-center text-gray-500", uploading && "opacity-60")}>
            {uploading ? "Uploading…" : "Attach a delivery ticket or photo"}
            <input
              id="mat-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      <RichTextField
        label="Notes (optional)"
        value={notesHtml}
        onChange={setNotesHtml}
        placeholder="Delivery condition, batch details, where it's stored. Add photos with the image button."
      />
    </FormDrawer>
  );
}
