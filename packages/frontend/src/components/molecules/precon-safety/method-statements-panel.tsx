import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import type { MethodStatement } from "@/api/precon-safety";
import {
  useConfirmMethodStatement,
  useCreateMethodStatement,
  useDeleteMethodStatement,
  useDraftMethodStatements,
  useMethodStatements,
  useUpdateMethodStatement,
} from "@/hooks/use-precon-safety";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { MethodStatementEditor } from "./method-statement-editor";
import { DraftButton, DraftStateChip } from "./safety-shared";

interface Props {
  proposalId: string;
  programmeTasks: { id: string; name: string }[];
}

export function MethodStatementsPanel({ proposalId, programmeTasks }: Props) {
  const { data: statements = [], isPending, isError, error } = useMethodStatements(proposalId);
  const create = useCreateMethodStatement(proposalId);
  const update = useUpdateMethodStatement(proposalId);
  const confirm = useConfirmMethodStatement(proposalId);
  const remove = useDeleteMethodStatement(proposalId);
  const draft = useDraftMethodStatements(proposalId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MethodStatement | null>(null);

  const selected = statements.find((s) => s.id === selectedId) ?? statements[0] ?? null;
  const fail = (fallback: string) => (err: unknown) => toast(getApiErrorMessage(err, fallback), "error");

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Method statements</p>
          <p className="text-xs text-gray-500">One per high-risk activity in the programme. Hazards, steps, controls and PPE, all editable.</p>
        </div>
        <div className="flex items-center gap-2">
          <DraftButton
            label="Draft from programme"
            loading={draft.isPending}
            onClick={() =>
              draft.mutate(undefined, {
                onSuccess: (rows) => {
                  toast(`${rows.length} method statement${rows.length === 1 ? "" : "s"} drafted.`, "success");
                  if (rows[0]) setSelectedId(rows[0].id);
                },
                onError: fail("Panda AI could not draft method statements."),
              })
            }
          />
          <Button
            size="sm"
            variant="secondary"
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { activityName: "New activity", hazards: [], steps: [] },
                { onSuccess: (row) => setSelectedId(row.id), onError: fail("Could not add the statement.") },
              )
            }
          >
            + New statement
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : isError ? (
        <p className="px-4 py-6 text-sm text-red-600">{getApiErrorMessage(error, "Could not load method statements.")}</p>
      ) : statements.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          No method statements yet. Draft them from the programme, or write the first one by hand.
        </p>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ul className="divide-y divide-gray-100 border-b border-gray-100 lg:border-b-0 lg:border-r">
            {statements.map((statement) => (
              <li key={statement.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(statement.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                    selected?.id === statement.id ? "bg-primary-50 text-primary-800" : "text-gray-800 hover:bg-gray-50",
                  )}
                >
                  <span className="truncate font-medium">{statement.activityName}</span>
                  <DraftStateChip state={statement.status} />
                </button>
              </li>
            ))}
          </ul>
          <div className="p-4">
            {selected ? (
              <MethodStatementEditor
                key={selected.id}
                statement={selected}
                programmeTasks={programmeTasks}
                saving={update.isPending || confirm.isPending}
                onSave={(body) =>
                  update.mutate(
                    { statementId: selected.id, body },
                    { onSuccess: () => toast("Method statement saved.", "success"), onError: fail("Could not save the statement.") },
                  )
                }
                onConfirm={() =>
                  confirm.mutate(selected.id, {
                    onSuccess: () => toast("Method statement confirmed.", "success"),
                    onError: fail("Could not confirm the statement."),
                  })
                }
                onDelete={() => setRemoveTarget(selected)}
              />
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        variant="danger"
        title="Delete this method statement?"
        description={removeTarget ? `The statement for "${removeTarget.activityName}" is deleted.` : undefined}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          remove.mutate(removeTarget.id, {
            onSuccess: () => {
              setRemoveTarget(null);
              setSelectedId(null);
            },
            onError: fail("Could not delete the statement."),
          });
        }}
      />
    </section>
  );
}
MethodStatementsPanel.displayName = "MethodStatementsPanel";
