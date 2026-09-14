import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { ToggleRow } from "@/components/atoms/toggle-row";
import type { ConvertInclude, ConvertPreview, ConvertSection } from "@/api/proposals";
import { useConvertPreview } from "@/hooks/use-proposals";
import { formatWholeCurrency } from "@/lib/formatters";

interface Props {
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  error: string | null;
  onConfirm: (include: ConvertInclude) => void;
}

// Sections a user may leave out. The project row, finances, and the proposal
// link are always written; the rest is a choice with the count in front of them.
const OPTIONAL: ReadonlySet<ConvertSection> = new Set([
  "programme",
  "milestones",
  "budget",
  "materials",
  "drawings",
  "documents",
  "selections",
  "safety",
  "client",
]);

function SectionRows({
  preview,
  include,
  onToggle,
}: {
  preview: ConvertPreview;
  include: ConvertInclude;
  onToggle: (key: ConvertSection, on: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {preview.sections.map((section) => (
        <ToggleRow
          key={section.key}
          title={section.label}
          description={section.detail}
          badge={section.available ? String(section.count) : undefined}
          checked={section.available && (include[section.key] ?? true)}
          disabled={!section.available || !OPTIONAL.has(section.key)}
          onChange={(on) => onToggle(section.key, on)}
        />
      ))}
    </div>
  );
}
SectionRows.displayName = "SectionRows";

export function ConvertPreviewDialog({ proposalId, open, onOpenChange, submitting, error, onConfirm }: Props) {
  const { data: preview, isPending, isError } = useConvertPreview(proposalId, open);
  const [include, setInclude] = useState<ConvertInclude>({});

  const blocked = preview?.warnings.some((w) => w.startsWith("Only an accepted")) ?? false;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create the project"
      description="Everything below comes from the accepted proposal and its take-off. Each row keeps a link back to what it was created from."
      submitLabel="Create project"
      submitting={submitting}
      submitDisabled={isPending || isError || blocked || preview?.alreadyConverted === true}
      error={error}
      onSubmit={() => onConfirm(include)}
      className="w-[min(600px,calc(100vw-2rem))]"
    >
      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : isError || !preview ? (
        <p className="text-sm text-negative-500">Could not load what conversion would create. Close and try again.</p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-surface-alt px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-ink">
                {preview.setup.projectType} · {preview.setup.buildingType} · {preview.setup.timeline}
              </p>
              <p className="text-xs text-ink-muted">
                {preview.setup.source === "takeoff-structure"
                  ? "Setup read from the take-off's structure reading"
                  : "Default setup; no structure reading on the take-off"}
              </p>
            </div>
            <p className="text-sm font-semibold text-ink">
              {formatWholeCurrency(preview.contractSum, preview.currency)}
            </p>
          </div>
          <SectionRows
            preview={preview}
            include={include}
            onToggle={(key, on) => setInclude((prev) => ({ ...prev, [key]: on }))}
          />
          {preview.warnings.length > 0 ? (
            <ul className="flex flex-col gap-1.5 rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
              {preview.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </FormDialog>
  );
}
ConvertPreviewDialog.displayName = "ConvertPreviewDialog";
