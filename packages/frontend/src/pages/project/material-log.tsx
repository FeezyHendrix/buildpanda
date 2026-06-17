import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Label } from "@/components/atoms/label";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useMaterialStock,
  useMaterialLedger,
  useLogMaterialEntry,
  useVoidMaterialEntry,
} from "@/hooks/use-materials-ledger";
import { uploadFileRequest } from "@/hooks/use-files";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/project-types";

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export default function ProjectMaterialLog() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: stock = [], isLoading: stockLoading } = useMaterialStock(project.id);
  const { data: entries = [], isLoading: ledgerLoading } = useMaterialLedger(project.id);
  const logEntry = useLogMaterialEntry(project.id);
  const voidEntry = useVoidMaterialEntry(project.id);

  const [logOpen, setLogOpen] = useState(false);
  const [voiding, setVoiding] = useState<LedgerEntry | null>(null);

  if (stockLoading || ledgerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Material Log"
        description="An audit trail of materials received and used on site, with live stock."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setLogOpen(true)}>
              <PlusIcon className="size-4" />
              Log material
            </Button>
          ) : null
        }
      />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Stock on hand</h2>
        {stock.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No materials logged yet.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stock.map((s) => (
              <Card key={`${s.materialId}-${s.locationKey}`} padding="md" className="flex flex-col gap-1">
                <span className="truncate text-sm font-medium text-gray-900">{s.materialName}</span>
                <span className={cn("text-2xl font-semibold tabular-nums", s.onHandQty < 0 ? "text-red-600" : "text-gray-900")}>
                  {s.onHandQty}
                  <span className="ml-1 text-xs font-normal text-gray-400">{s.unit}</span>
                </span>
                {s.onHandQty < 0 ? (
                  <Badge tone="danger" size="sm">Negative</Badge>
                ) : s.lowStock ? (
                  <Badge tone="warning" size="sm">Low stock</Badge>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Activity</h2>
        {entries.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No entries yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <LedgerRow
                key={e.id}
                entry={e}
                canManage={canManage}
                onVoid={() => setVoiding(e)}
              />
            ))}
          </div>
        )}
      </section>

      <LogMaterialDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        submitting={logEntry.isPending}
        onSubmit={(input) =>
          logEntry.mutate(input, {
            onSuccess: (res) => {
              setLogOpen(false);
              if (res.negativeStock) {
                toast(`Logged. Heads up: ${input.materialName} is now at ${res.onHandQty}.`, "error");
              } else {
                toast("Material logged", "success");
              }
            },
            onError: () => toast("Could not log material"),
          })
        }
      />

      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(open) => { if (!open) setVoiding(null); }}
        onConfirm={() => {
          if (voiding) {
            voidEntry.mutate(
              { entryId: voiding.id, reason: "Voided from Material Log" },
              { onError: () => toast("Could not void entry") },
            );
          }
        }}
        title="Void this entry?"
        description={
          voiding
            ? `This reverses ${voiding.entryType} of ${voiding.quantity} ${voiding.unit} ${voiding.materialName}. The original stays in the log; a reversing entry restores stock.`
            : ""
        }
        confirmLabel="Void entry"
        variant="danger"
      />
    </div>
  );
}

function LedgerRow({
  entry,
  canManage,
  onVoid,
}: {
  entry: LedgerEntry;
  canManage: boolean;
  onVoid: () => void;
}) {
  const isVoided = entry.status === "Voided";
  const isIn = entry.entryType === "IN";
  const isVoid = entry.entryType === "VOID";

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3", isVoided && "opacity-60")}>
      <span
        className={cn(
          "flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          isVoid ? "bg-gray-100 text-gray-500" : isIn ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
        )}
      >
        {isVoid ? "VOID" : isIn ? "IN" : "USED"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {entry.quantity} {entry.unit} · {entry.materialName}
          {entry.negativeStock && <Badge tone="danger" size="sm" className="ml-2">Negative</Badge>}
          {entry.timestampSuspect && <Badge tone="warning" size="sm" className="ml-2">Time flagged</Badge>}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {entry.loggedByName ?? "Someone"} · {formatTimeAgo(entry.occurredAt)}
          {entry.reason ? ` · ${entry.reason}` : ""}
        </p>
      </div>
      {entry.files.length > 0 && (
        <a
          href={entry.files[0]!.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-medium text-[#004DE7] hover:underline"
        >
          Photo
        </a>
      )}
      {canManage && !isVoided && !isVoid && (
        <button
          type="button"
          onClick={onVoid}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          Void
        </button>
      )}
    </div>
  );
}

function LogMaterialDrawer({
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
  }) => void;
}) {
  const [entryType, setEntryType] = useState<"IN" | "USED">("IN");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("bags");
  const [quantity, setQuantity] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset(): void {
    setEntryType("IN");
    setMaterialName("");
    setUnit("bags");
    setQuantity("");
    setFileId(null);
    setFileName(null);
  }

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
          <input
            id="mat-qty"
            type="number"
            inputMode="decimal"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
    </FormDrawer>
  );
}
