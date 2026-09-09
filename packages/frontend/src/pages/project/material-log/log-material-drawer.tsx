import { useEffect, useState, type ComponentType } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { uploadFileRequest } from "@/hooks/use-files";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { UnitInput } from "@/components/atoms/unit-input";
import { ComboInput } from "@/components/atoms/combo-input";
import { ArrowIntoSiteIcon, ArrowOutOfSiteIcon } from "./icons";

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

/**
 * The two directions a material can move. Each carries an icon as well as a
 * label so the selected direction is never signalled by fill colour alone.
 */
const ENTRY_TYPE_CHOICES: {
  value: "IN" | "USED";
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "IN", label: "Received", Icon: ArrowIntoSiteIcon },
  { value: "USED", label: "Used", Icon: ArrowOutOfSiteIcon },
];

export interface MaterialOption {
  name: string;
  unit: string;
}

export interface StageOption {
  id: string;
  name: string;
}

export function LogMaterialDrawer({
  open,
  onOpenChange,
  materials,
  stages,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: MaterialOption[];
  stages: StageOption[];
  submitting: boolean;
  onSubmit: (input: {
    entryType: "IN" | "USED";
    materialName: string;
    unit: string;
    quantity: number;
    stageId?: string | null;
    fileIds?: string[];
    notesHtml?: string | null;
  }) => void;
}) {
  const [entryType, setEntryType] = useState<"IN" | "USED">("IN");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("bags");
  const [quantity, setQuantity] = useState("");
  const [stageId, setStageId] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notesHtml, setNotesHtml] = useState("");

  function reset(): void {
    setEntryType("IN");
    setMaterialName("");
    setUnit("bags");
    setQuantity("");
    setStageId("");
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

  function handleMaterialChange(next: string | null): void {
    const name = next ?? "";
    setMaterialName(name);
    const normalized = name.trim().toLowerCase();
    const match = materials.find((m) => m.name.toLowerCase() === normalized);
    if (match?.unit) setUnit(match.unit);
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
      stageId: stageId || null,
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-entry-type">Movement</Label>
        <div
          id="mat-entry-type"
          role="group"
          aria-label="Movement type"
          className="flex gap-2"
        >
          {ENTRY_TYPE_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={entryType === choice.value}
              onClick={() => setEntryType(choice.value)}
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                entryType === choice.value
                  ? "bg-primary-500 text-white"
                  : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
              )}
            >
              <choice.Icon className="size-4" />
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-name">Material</Label>
        <ComboInput
          id="mat-name"
          items={materials.map((m) => m.name)}
          value={materialName || null}
          onChange={handleMaterialChange}
          placeholder="Select or type material…"
          emptyText="No match — keep typing to use a custom material."
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
        <div className="flex w-36 flex-col gap-1.5">
          <Label htmlFor="mat-unit">Unit</Label>
          <UnitInput id="mat-unit" value={unit} onChange={setUnit} className={FIELD} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-stage">Build stage (optional)</Label>
        <select
          id="mat-stage"
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className={FIELD}
        >
          <option value="">Not assigned to a stage</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-photo">Photo proof (optional)</Label>
        {fileId ? (
          <div className="flex items-center justify-between rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-700">
            <span className="truncate">{fileName}</span>
            <button type="button" onClick={() => { setFileId(null); setFileName(null); }} className="text-gray-400 hover:text-error-600">
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
