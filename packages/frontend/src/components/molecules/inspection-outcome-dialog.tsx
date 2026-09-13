import { useEffect, useRef, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useUploadFile } from "@/hooks/use-files";
import { useRecordInspectionOutcome } from "@/hooks/use-inspections";
import { errorMessage, isStorageUnavailable } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { InspectionOutcome, InspectionReport } from "@/lib/project-types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

interface InspectionOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  inspection: InspectionReport | null;
}

function nextWeekIso(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Pass or fail, recorded once. "Action required" used to carry no reason, no
 * findings, no photo and no re-inspection date, and moving it back to Scheduled
 * kept the date that had already passed (finding F45).
 */
function InspectionOutcomeDialog({ open, onOpenChange, projectId, inspection }: InspectionOutcomeDialogProps) {
  const [outcome, setOutcome] = useState<InspectionOutcome>("pass");
  const [findings, setFindings] = useState("");
  const [reinspectionDate, setReinspectionDate] = useState(nextWeekIso());
  const [media, setMedia] = useState<{ type: "photo" | "video"; url: string }[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile();
  const record = useRecordInspectionOutcome();

  useEffect(() => {
    if (open) {
      setOutcome("pass");
      setFindings("");
      setReinspectionDate(nextWeekIso());
      setMedia([]);
      setUploadNote(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  if (!inspection) return null;

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setUploadNote(null);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadFile.mutateAsync({ file, projectId });
        setMedia((prev) => [
          ...prev,
          {
            type: file.type.startsWith("video") ? "video" : "photo",
            url: `${API_BASE}/files/${uploaded.id}/download`,
          },
        ]);
      } catch (error) {
        // The findings matter more than the photo — never lose them to a 503.
        setUploadNote(
          isStorageUnavailable(error)
            ? `${file.name} could not be attached — file storage is unavailable. The findings below are still saved.`
            : `${file.name} could not be attached — ${errorMessage(error)}`,
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const failing = outcome === "fail";
  const isValid = !failing || findings.trim().length > 0;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Record the result — ${inspection.title}`}
      description="A failed inspection needs findings and a re-inspection date; the request is moved to that date so it stays on the programme."
      submitLabel={failing ? "Record fail & reschedule" : "Record pass"}
      submitDisabled={!isValid || uploadFile.isPending}
      submitting={record.isPending}
      error={record.error ? errorMessage(record.error) : null}
      onSubmit={() =>
        record.mutate(
          {
            projectId,
            inspectionId: inspection.id,
            outcome,
            findings: findings.trim() || null,
            reinspectionDate: failing ? reinspectionDate : null,
            media,
          },
          {
            onSuccess: () => {
              onOpenChange(false);
              toast(failing ? "Fail recorded and re-inspection set" : "Inspection passed", "success");
            },
          },
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label>Result</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="md"
            aria-pressed={outcome === "pass"}
            variant={outcome === "pass" ? "primary" : "secondary"}
            onClick={() => setOutcome("pass")}
          >
            ✓ Pass
          </Button>
          <Button
            type="button"
            size="md"
            aria-pressed={failing}
            variant={failing ? "primary" : "secondary"}
            onClick={() => setOutcome("fail")}
          >
            ✕ Fail
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-findings">
          Findings{failing ? " (required)" : " (optional)"}
        </Label>
        <textarea
          id="inspection-findings"
          rows={4}
          value={findings}
          onChange={(event) => setFindings(event.target.value)}
          maxLength={4000}
          placeholder={
            failing
              ? "What failed, where, and what has to be put right before re-inspection."
              : "Anything worth recording about the inspection."
          }
          className={cn(INPUT_CLASS, "h-auto min-h-24 resize-y py-3")}
        />
      </div>

      {failing ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reinspection-date">Re-inspection date</Label>
          <input
            id="reinspection-date"
            type="date"
            value={reinspectionDate}
            onChange={(event) => setReinspectionDate(event.target.value)}
            className={INPUT_CLASS}
          />
          <p className="text-xs text-gray-500">The inspection is rescheduled to this date.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-photos">Photos</Label>
        <input
          ref={fileInputRef}
          id="inspection-photos"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
          className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-alt file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        {media.length > 0 ? (
          <p className="text-xs text-gray-500">{media.length} attached</p>
        ) : null}
        {uploadNote ? (
          <p className="rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">{uploadNote}</p>
        ) : null}
      </div>
    </FormDrawer>
  );
}

InspectionOutcomeDialog.displayName = "InspectionOutcomeDialog";

export { InspectionOutcomeDialog, type InspectionOutcomeDialogProps };
