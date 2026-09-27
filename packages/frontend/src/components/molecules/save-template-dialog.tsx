import { useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useSaveProposalTemplate } from "@/hooks/use-proposal-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  suggestedName: string;
}

export function SaveTemplateDialog({ open, onOpenChange, proposalId, suggestedName }: Props) {
  const save = useSaveProposalTemplate();
  const [name, setName] = useState(suggestedName);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save as template"
      description="Keeps this proposal's payment stages, terms, tax settings and pack text for the next job. Line items and prices are not included."
      submitLabel="Save template"
      submitDisabled={name.trim().length === 0}
      submitting={save.isPending}
      error={save.error ? getApiErrorMessage(save.error, "Could not save the template.") : null}
      onSubmit={() =>
        save.mutate(
          { proposalId, name: name.trim() },
          {
            onSuccess: (tpl) => { toast(`Saved "${tpl.name}" as a template.`, "success"); onOpenChange(false); },
          },
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-name">Template name</Label>
        <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Residential, labour only" autoFocus />
      </div>
    </FormDialog>
  );
}
SaveTemplateDialog.displayName = "SaveTemplateDialog";
