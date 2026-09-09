import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { RISK_LEVELS_3, RISK_STATUSES, type ProposalRisk, type RiskInput } from "@/api/precon-safety";
import { cn } from "@/lib/utils";
import { DraftStateChip, EnumSelect, cellInputClass, cellTextareaClass } from "./safety-shared";

interface Props {
  risk: ProposalRisk;
  onSave: (body: RiskInput) => void;
  onConfirm: () => void;
  onDelete: () => void;
  saving: boolean;
}

const SCORE_TONE = (score: number | null) =>
  score === null ? "bg-gray-100 text-gray-500" : score >= 6 ? "bg-red-100 text-red-700" : score >= 3 ? "bg-amber-100 text-amber-700" : "bg-success-100 text-success-700";

// Every field commits on its own: text on blur, selects on change. The row
// never holds unsaved state longer than one field, so a refresh loses nothing.
export function RiskRow({ risk, onSave, onConfirm, onDelete, saving }: Props) {
  const [title, setTitle] = useState(risk.title);
  const [description, setDescription] = useState(risk.description);
  const [mitigation, setMitigation] = useState(risk.mitigation ?? "");
  const [owner, setOwner] = useState(risk.ownerName ?? "");

  const commitText = (key: "title" | "description" | "mitigation" | "ownerName", value: string, original: string) => {
    if (value === original) return;
    if (key === "title" || key === "description") {
      if (!value.trim()) return;
      onSave({ [key]: value.trim() });
      return;
    }
    onSave({ [key]: value.trim() || null });
  };

  return (
    <li className={cn("grid gap-2 px-4 py-3", risk.status === "closed" && "opacity-60")}>
      <div className="grid grid-cols-[minmax(0,2fr)_110px_110px_64px_minmax(0,1fr)_120px_130px_auto] items-center gap-2">
        <input
          aria-label="Risk title"
          className={cn(cellInputClass, "font-medium")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commitText("title", title, risk.title)}
        />
        <EnumSelect ariaLabel="Likelihood" value={risk.likelihood} options={RISK_LEVELS_3} placeholder="Likelihood" onChange={(v) => onSave({ likelihood: v })} />
        <EnumSelect ariaLabel="Impact" value={risk.impact} options={RISK_LEVELS_3} placeholder="Impact" onChange={(v) => onSave({ impact: v })} />
        <span className={cn("flex h-8 items-center justify-center rounded-lg text-xs font-bold tabular-nums", SCORE_TONE(risk.score))} title="Likelihood × impact">
          {risk.score ?? "—"}
        </span>
        <input
          aria-label="Owner"
          className={cellInputClass}
          placeholder="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={() => commitText("ownerName", owner, risk.ownerName ?? "")}
        />
        <EnumSelect ariaLabel="Status" value={risk.status} options={RISK_STATUSES} onChange={(v) => v && onSave({ status: v })} />
        <input
          aria-label="Review date"
          type="date"
          className={cellInputClass}
          value={risk.reviewDate ?? ""}
          onChange={(e) => onSave({ reviewDate: e.target.value || null })}
        />
        <div className="flex items-center gap-1">
          <DraftStateChip state={risk.editState} />
          {risk.editState !== "confirmed" ? (
            <Button size="sm" variant="ghost" className="text-primary-700" loading={saving} onClick={onConfirm}>
              Confirm
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={onDelete}>
            Remove
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Cause and effect
          <textarea
            className={cn(cellTextareaClass, "mt-1 font-normal normal-case tracking-normal")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => commitText("description", description, risk.description)}
          />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Mitigation
          <textarea
            className={cn(cellTextareaClass, "mt-1 font-normal normal-case tracking-normal")}
            placeholder="What the contractor will do about it"
            value={mitigation}
            onChange={(e) => setMitigation(e.target.value)}
            onBlur={() => commitText("mitigation", mitigation, risk.mitigation ?? "")}
          />
        </label>
      </div>
    </li>
  );
}
RiskRow.displayName = "RiskRow";
