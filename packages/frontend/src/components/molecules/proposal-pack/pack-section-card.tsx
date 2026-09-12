import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { RichTextField } from "@/components/molecules/rich-text-field";
import type { PackOrigin, PackSection, PackSectionKind } from "@/api/proposals";

export interface PackSectionMeta {
  kind: PackSectionKind;
  title: string;
  hint: string;
  draftable: boolean;
}

export const PACK_SECTION_META: readonly PackSectionMeta[] = [
  { kind: "scope", title: "Scope of works", hint: "What is being built, in the client's language. This is the narrative the client reads.", draftable: true },
  { kind: "exclusions", title: "Exclusions", hint: "What the price does not cover: boundary walls, external works, furniture, permits.", draftable: true },
  { kind: "assumptions", title: "Assumptions", hint: "Site access, power and water on site, soil conditions, working hours.", draftable: true },
  { kind: "provisional_sums", title: "Provisional sums", hint: "Allowances for work not yet designed, such as kitchen fittings or sanitaryware.", draftable: true },
  { kind: "warranties", title: "Warranties", hint: "Workmanship and materials guarantees. Your own words; Panda AI does not draft these.", draftable: false },
  { kind: "terms", title: "Terms and conditions", hint: "Payment, variations, retention, disputes. Your standard terms.", draftable: false },
  { kind: "site_survey", title: "Site survey", hint: "Existing conditions, access, boundaries, soil observations. Internal, not shown to the client.", draftable: false },
] as const;

const ORIGIN_META: Record<PackOrigin, { label: string; tone: BadgeTone }> = {
  ai: { label: "AI draft", tone: "info" },
  manual: { label: "Edited", tone: "success" },
  prompt: { label: "Via prompt", tone: "info" },
  template: { label: "From template", tone: "neutral" },
};

interface Props {
  meta: PackSectionMeta;
  section: PackSection | null;
  canEdit: boolean;
  saving: boolean;
  drafting: boolean;
  onSave: (kind: PackSectionKind, bodyHtml: string) => void;
  onDraft: (kind: PackSectionKind) => void;
}

// One pack section: AI drafts it, a person edits it in place. The origin badge
// keeps the two states distinct until someone saves an edit.
export function PackSectionCard({ meta, section, canEdit, saving, drafting, onSave, onDraft }: Props) {
  const [html, setHtml] = useState(section?.bodyHtml ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setHtml(section?.bodyHtml ?? "");
    setDirty(false);
  }, [section?.id, section?.bodyHtml, section?.updatedAt]);

  const origin = section ? ORIGIN_META[section.origin] : null;

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{meta.title}</h3>
            {origin ? <Badge tone={origin.tone}>{origin.label}</Badge> : <Badge tone="neutral">Empty</Badge>}
          </div>
          <p className="mt-1 text-xs text-gray-500">{meta.hint}</p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            {meta.draftable ? (
              <Button size="sm" variant="ghost" className="text-primary-700" loading={drafting} onClick={() => onDraft(meta.kind)}>
                <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                {section ? "Redraft with Panda AI" : "Draft with Panda AI"}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" loading={saving} disabled={!dirty} onClick={() => onSave(meta.kind, html)}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
      <RichTextField
        value={html}
        onChange={(next) => {
          setHtml(next);
          setDirty(true);
        }}
        disabled={!canEdit}
        placeholder={meta.draftable ? "Write it, or let Panda AI draft a first version you can edit." : "Write your standard wording here."}
      />
    </section>
  );
}
PackSectionCard.displayName = "PackSectionCard";
