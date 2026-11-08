import { useEffect, useState } from "react";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { INPUT_BASE_CLASS } from "@/components/atoms/input";
import { InfoTooltip } from "@/components/atoms/tooltip";
import { cn } from "@/lib/utils";
import { ApprovalAttachmentsField } from "./approval-attachments-field";
import { DateInputField } from "./date-input-field";
import { FormDrawer } from "./form-drawer";

export interface UpsertApprovalValues {
  title: string;
  category: string | null;
  description: string | null;
  dueDate: string | null;
  requestedReviewerId: string | null;
  /** Files picked on a new request; sent only once the server accepts attachments. */
  files?: File[];
}

export interface ReviewerOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertApprovalValues>;
  reviewerOptions?: ReviewerOption[];
  /** From GET /approval-categories; the built-in list is the fallback. */
  categoryOptions?: string[];
  /** The input a 422 blamed (`title`, `dueDate`, `requestedReviewerId`, `attachments`). */
  errorField?: string | null;
  onSubmit: (values: UpsertApprovalValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  /** Whether picked files are actually sent; when not, the dialog says so instead of dropping them silently. */
  attachmentsEnabled?: boolean;
}

const DEFAULT_CATEGORIES = ["Finishes", "Fittings", "Materials", "Structural", "Other"];

function FieldError({ field, blamed, message }: { field: string; blamed: string | null; message: string | null | undefined }) {
  if (blamed !== field || !message) return null;
  return <p className="text-caption-m! text-negative-600">{message}</p>;
}
const ANY_APPROVER = "__any__";

const LABEL_CLASS = "text-caption-m! font-semibold text-[#1E1E1E]";
const FIELD_HEIGHT = "h-[46px]";

function UpsertApprovalDialog({
  open,
  onOpenChange,
  mode,
  initial,
  reviewerOptions = [],
  categoryOptions,
  errorField = null,
  onSubmit,
  isSubmitting = false,
  error,
  attachmentsEnabled = true,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [requestedReviewerId, setRequestedReviewerId] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? null);
      setDescription(initial?.description ?? "");
      setDueDate(initial?.dueDate ?? "");
      setRequestedReviewerId(initial?.requestedReviewerId ?? "");
      setFiles([]);
    }
  }, [open, initial]);

  const approverOptions = [
    { value: ANY_APPROVER, label: "Anyone who can approve" },
    ...reviewerOptions.map((r) => ({ value: r.id, label: r.name })),
  ];

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim() || null,
      dueDate: dueDate || null,
      requestedReviewerId: requestedReviewerId || null,
      files,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "create" ? "New approval request" : "Edit approval request"
      }
      description="Send a selection, specification, or project decision to the right person for review."
      submitLabel={mode === "create" ? "Send for approval" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={errorField ? null : (error ?? null)}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ap-title" className={LABEL_CLASS}>
            What needs approval?
          </label>
          <TextInput
            id="ap-title"
            value={title}
            onChange={setTitle}
            placeholder="e.g. Living room floor tile selection"
            className={cn(FIELD_HEIGHT, "px-4")}
            aria-invalid={errorField === "title" || undefined}
          />
          <FieldError field="title" blamed={errorField} message={error} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ap-category" className={LABEL_CLASS}>
              Category
            </label>
            <Select
              id="ap-category"
              options={(categoryOptions?.length ? categoryOptions : DEFAULT_CATEGORIES).map((c) => ({ value: c, label: c }))}
              value={category}
              onChange={setCategory}
              placeholder="Select a category"
              className={cn(FIELD_HEIGHT, "px-4 text-caption-l!")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ap-due" className={LABEL_CLASS}>
                Decision needed by
              </label>
              <InfoTooltip text="Set a deadline so the project isn't delayed." />
            </div>
            <DateInputField
              id="ap-due"
              value={dueDate}
              onChange={setDueDate}
              className={FIELD_HEIGHT}
            />
            <FieldError field="dueDate" blamed={errorField} message={error} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ap-desc" className={LABEL_CLASS}>
              More Information
            </label>
            <InfoTooltip text="Include relevant dimensions, materials, finishes, quantities, or other information needed to make a decision." />
          </div>
          <textarea
            id="ap-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            placeholder="Describe the selection, specification, or decision you'd like the approver to review."
            className={cn(
              INPUT_BASE_CLASS,
              "h-[130px] resize-none py-3 leading-5",
            )}
          />
        </div>

        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <ApprovalAttachmentsField
              files={files}
              onChange={setFiles}
              disabled={isSubmitting}
            />
            <FieldError field="attachments" blamed={errorField} message={error} />
            {!attachmentsEnabled && files.length > 0 ? (
              <p role="status" className="text-caption-m! text-warning-600">
                File upload is not switched on for approvals yet, so these files
                will not be sent with the request.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ap-reviewer" className={LABEL_CLASS}>
            Approver
          </label>
          <Select
            id="ap-reviewer"
            options={approverOptions}
            value={requestedReviewerId || null}
            onChange={(next) =>
              setRequestedReviewerId(!next || next === ANY_APPROVER ? "" : next)
            }
            placeholder="Select who's needed to approve"
            className={cn(FIELD_HEIGHT, "px-4 text-caption-l!")}
          />
          <FieldError field="requestedReviewerId" blamed={errorField} message={error} />
        </div>
      </div>
    </FormDrawer>
  );
}

UpsertApprovalDialog.displayName = "UpsertApprovalDialog";

export { UpsertApprovalDialog };
