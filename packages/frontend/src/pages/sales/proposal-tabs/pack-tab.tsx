import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { PACK_SECTION_META, PackSectionCard } from "@/components/molecules/proposal-pack/pack-section-card";
import type { PackSectionKind } from "@/api/proposals";
import { useAbility } from "@/contexts/ability-context";
import { useDraftPack, useProposalPack, useUpsertPackSection } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  proposalId: string;
}

// The prose of the offer: what the client reads around the price. Every
// section is a rich-text field; Panda AI drafts the four factual ones from the
// brief, the structure reading and the measured bill, and a person finishes them.
export function PackTab({ proposalId }: Props) {
  const ability = useAbility();
  const canEdit = ability.can("update", "proposals");
  const { data: sections = [], isPending } = useProposalPack(proposalId);
  const upsert = useUpsertPackSection(proposalId);
  const draft = useDraftPack(proposalId);
  const [busyKind, setBusyKind] = useState<PackSectionKind | null>(null);

  const byKind = new Map(sections.map((s) => [s.kind, s]));
  const emptyDraftable = PACK_SECTION_META.filter((m) => m.draftable && !byKind.get(m.kind)?.bodyHtml.trim()).map((m) => m.kind);

  const save = (kind: PackSectionKind, bodyHtml: string) => {
    setBusyKind(kind);
    upsert.mutate(
      { kind, bodyHtml, origin: "manual" },
      {
        onSuccess: () => toast("Section saved.", "success"),
        onError: (err) => toast(getApiErrorMessage(err, "Could not save the section."), "error"),
        onSettled: () => setBusyKind(null),
      },
    );
  };

  const runDraft = (kinds: PackSectionKind[]) => {
    setBusyKind(kinds[0] ?? null);
    draft.mutate(kinds, {
      onSuccess: (saved) => toast(`Panda AI drafted ${saved.length} section${saved.length === 1 ? "" : "s"}. Edit before sending.`, "success"),
      onError: (err) => toast(getApiErrorMessage(err, "Panda AI could not draft the pack."), "error"),
      onSettled: () => setBusyKind(null),
    });
  };

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="max-w-2xl text-sm text-gray-600">
          These sections are rendered on the client's proposal page and frozen into the PDF when you send. The site survey
          stays internal.
        </p>
        {canEdit && emptyDraftable.length > 0 ? (
          <Button size="sm" loading={draft.isPending && busyKind !== null && emptyDraftable.includes(busyKind)} onClick={() => runDraft(emptyDraftable)}>
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
            Draft the empty sections
          </Button>
        ) : null}
      </div>
      {PACK_SECTION_META.map((meta) => (
        <PackSectionCard
          key={meta.kind}
          meta={meta}
          section={byKind.get(meta.kind) ?? null}
          canEdit={canEdit}
          saving={upsert.isPending && busyKind === meta.kind}
          drafting={draft.isPending && busyKind === meta.kind}
          onSave={save}
          onDraft={(kind) => runDraft([kind])}
        />
      ))}
    </div>
  );
}
PackTab.displayName = "PackTab";
