import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Sparkles, X } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ChangePreview } from "@/components/molecules/precon-assist/change-preview";
import type { AssistSurface, ChangeSet } from "@/api/precon-assist";
import {
  useApplyChangeSet,
  useDiscardChangeSet,
  useProposeChangeSet,
  useUndoChangeSet,
} from "@/hooks/use-precon-assist";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  surface: AssistSurface;
  surfaceLabel: string;
}

const SURFACE_HINT: Record<AssistSurface, string> = {
  bill: 'Try "reject every line under 0.5 m²", "price all blockwork at 4,800", or "verify the door and window lines".',
  programme: 'Try "shorten blockwork by five days without moving roof-on" or "mark the substructure tasks verified".',
  estimate: "Not available on the estimate yet.",
  pack: "Not available on the pack yet.",
  risks: "Not available on the risk register yet.",
};

function PlanList({ plan }: { plan: string[] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Sparkles className="size-3.5 text-primary-600" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
        {plan.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
PlanList.displayName = "PlanList";

export function AssistDrawer({ open, onOpenChange, sessionId, surface, surfaceLabel }: Props) {
  const [prompt, setPrompt] = useState("");
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [editing, setEditing] = useState(true);

  const propose = useProposeChangeSet(sessionId);
  const apply = useApplyChangeSet(sessionId);
  const undo = useUndoChangeSet(sessionId);
  const discard = useDiscardChangeSet(sessionId);

  const submit = () => {
    const text = prompt.trim();
    if (text.length < 3) return;
    propose.mutate(
      { sessionId, surface, prompt: text },
      {
        onSuccess: (set) => {
          setChangeSet(set);
          setEditing(false);
        },
        onError: (e) => toast(getApiErrorMessage(e, "Panda AI could not make a plan."), "error"),
      },
    );
  };

  const run = (action: typeof apply, verb: string) => {
    if (!changeSet) return;
    action.mutate(changeSet.id, {
      onSuccess: (set) => {
        setChangeSet(set);
        toast(`${verb} ${set.appliedResult?.applied ?? set.changes.length} change${set.changes.length === 1 ? "" : "s"}.`, "success");
      },
      onError: (e) => toast(getApiErrorMessage(e, `Could not ${verb.toLowerCase()} the changes.`), "error"),
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col bg-gray-50 shadow-xl outline-none",
            "transition-transform duration-300 ease-out data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-4">
            <Sparkles className="size-4 text-primary-600" aria-hidden="true" />
            <Dialog.Title className="text-base font-semibold text-gray-900">Ask Panda AI</Dialog.Title>
            <Badge tone="accent">{surfaceLabel}</Badge>
            <Dialog.Close
              aria-label="Close"
              className="ml-auto flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="assist-prompt">
                What should change?
              </label>
              <textarea
                id="assist-prompt"
                rows={3}
                value={prompt}
                readOnly={!editing}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                placeholder={SURFACE_HINT[surface]}
                className={cn(
                  "mt-1.5 w-full resize-none rounded-lg border-0 bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none",
                  "placeholder:text-gray-400 focus:ring-2 focus:ring-primary-100",
                  !editing && "text-gray-600",
                )}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-400">{editing ? "⌘↩ to send" : "Read the plan below before applying."}</p>
                {editing ? (
                  <Button size="sm" loading={propose.isPending} disabled={prompt.trim().length < 3} onClick={submit}>
                    Preview changes
                  </Button>
                ) : changeSet?.status === "proposed" ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    Change the plan
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(true);
                      setChangeSet(null);
                    }}
                  >
                    New request
                  </Button>
                )}
              </div>
            </section>

            {propose.isPending ? (
              <p className="px-1 text-sm text-gray-500">Panda AI is reading the {surfaceLabel.toLowerCase()} and drafting a plan…</p>
            ) : null}

            {changeSet ? (
              <>
                <PlanList plan={changeSet.plan} />
                <ChangePreview
                  changeSet={changeSet}
                  applying={apply.isPending}
                  undoing={undo.isPending}
                  discarding={discard.isPending}
                  onApply={() => run(apply, "Applied")}
                  onUndo={() => run(undo, "Undid")}
                  onDiscard={() =>
                    discard.mutate(changeSet.id, {
                      onSuccess: () => {
                        setChangeSet(null);
                        setEditing(true);
                      },
                      onError: (e) => toast(getApiErrorMessage(e, "Could not discard the plan."), "error"),
                    })
                  }
                />
              </>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
AssistDrawer.displayName = "AssistDrawer";
