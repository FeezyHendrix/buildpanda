import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useChangeRequests } from "@/hooks/use-change-requests";
import { useConvertRfiToChange } from "@/hooks/use-rfis";
import { errorMessage } from "@/lib/api-error";
import { formatWholeCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ConvertToChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rfiId: string;
  rfiNumber: number;
  rfiSubject: string;
}

type Mode = "new" | "existing";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "new", label: "Raise a new change request", hint: "Creates a draft for the commercial team to price." },
  { value: "existing", label: "Link an existing change request", hint: "Use when the variation is already raised." },
];

/**
 * One site event is one change event. Converting used to mint a second, ₦0 draft
 * beside the variation the QS had already raised (finding F39), so linking is
 * offered first-class here.
 */
function ConvertToChangeDialog({
  open,
  onOpenChange,
  projectId,
  rfiId,
  rfiNumber,
  rfiSubject,
}: ConvertToChangeDialogProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [changeRequestId, setChangeRequestId] = useState<string | null>(null);
  const { data: changeRequests = [] } = useChangeRequests(open ? projectId : undefined);
  const convert = useConvertRfiToChange();

  useEffect(() => {
    if (open) {
      setMode("new");
      setChangeRequestId(null);
    }
  }, [open]);

  const items: ComboItem[] = changeRequests.map((cr) => ({
    id: cr.id,
    label: `${cr.title} · ${cr.status} · ${formatWholeCurrency(cr.costImpact, cr.currency)}`,
  }));

  const canSubmit = mode === "new" || Boolean(changeRequestId);

  function submit(): void {
    convert.mutate(
      {
        projectId,
        rfiId,
        changeRequestId: mode === "existing" ? changeRequestId : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast(
            mode === "existing" ? "RFI linked to the change request" : "Change request raised from this RFI",
            "success",
          );
        },
      },
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Convert to a change event"
      description={`RFI-${rfiNumber} · ${rfiSubject}`}
      submitLabel={mode === "existing" ? "Link change request" : "Raise change request"}
      submitDisabled={!canSubmit}
      submitting={convert.isPending}
      error={convert.error ? errorMessage(convert.error) : null}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-2">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className={cn(
              "rounded-lg border p-3 text-left text-sm outline-none transition-colors",
              mode === option.value
                ? "border-primary-500 bg-primary-50 text-gray-900"
                : "border-line-hair bg-white text-gray-700 hover:bg-surface-alt",
            )}
          >
            <span className="font-medium">
              {mode === option.value ? "● " : "○ "}
              {option.label}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700" htmlFor="cr-picker">
            Change request
          </label>
          <ComboSelect
            items={items}
            value={changeRequestId}
            onChange={setChangeRequestId}
            placeholder={items.length === 0 ? "No change requests on this project" : "Choose a change request…"}
            searchPlaceholder="Search change requests…"
            emptyText="No change requests match"
          />
        </div>
      ) : null}
    </FormDialog>
  );
}

ConvertToChangeDialog.displayName = "ConvertToChangeDialog";

export { ConvertToChangeDialog, type ConvertToChangeDialogProps };
