import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { UpsertAssemblyDialog } from "@/components/molecules/rate-library/upsert-assembly-dialog";
import type { Assembly } from "@/api/precon";
import type { RateCard } from "@/api/rate-library";
import { useAssemblies, useDeleteAssembly } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  cards: RateCard[];
  canManage: boolean;
}

/** Either creating (initial null) or editing one; closed when absent. */
type Editing = { initial: Assembly | null } | null;

function describeItems(assembly: Assembly): string {
  const shown = assembly.items.slice(0, 3).map((i) => `${i.description} × ${i.factor}`);
  const rest = assembly.items.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}

function AssemblyRow({ assembly, canManage, onEdit, onDelete }: { assembly: Assembly; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-900">
        {assembly.name}
        <span className="ml-2 text-[11px] text-gray-400">{assembly.elementGroup}</span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">per {assembly.unit}</td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {assembly.items.length} item{assembly.items.length === 1 ? "" : "s"}
        <span className="ml-1 text-gray-400">· {describeItems(assembly)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <span className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={onDelete}>
              Delete
            </Button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}
AssemblyRow.displayName = "AssemblyRow";

/**
 * The org's assemblies: recipes that turn one drawn shape into several bill
 * lines. They live with the rate library because their items price from it.
 */
export function AssembliesPanel({ cards, canManage }: Props) {
  const { data: assemblies = [], isPending, isError } = useAssemblies();
  const remove = useDeleteAssembly();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Assembly | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          An assembly is measured once and billed as every item it carries: draw a wall, get the blockwork, the plaster and the paint.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => setEditing({ initial: null })}>
            <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
            New assembly
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : isError ? (
        <EmptyState title="Could not load the assemblies" description="Refresh the page to try again." />
      ) : assemblies.length === 0 ? (
        <EmptyState title="No assemblies yet" description="Create one above. In the sheet viewer, pick it from the composer and one drawn shape makes all of its lines." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Assembly</th>
                <th className="px-3 py-2 font-medium">Drawn as</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assemblies.map((assembly) => (
                <AssemblyRow
                  key={assembly.id}
                  assembly={assembly}
                  canManage={canManage}
                  onEdit={() => setEditing({ initial: assembly })}
                  onDelete={() => setDeleting(assembly)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <UpsertAssemblyDialog
          key={editing.initial?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          initial={editing.initial}
          cards={cards}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        variant="danger"
        title="Delete this assembly?"
        description={deleting ? `${deleting.name} will no longer be offered in the composer. Lines already measured with it stay in their bills.` : ""}
        confirmLabel="Delete assembly"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => {
              setDeleting(null);
              toast(getApiErrorMessage(e, "Could not delete the assembly."), "error");
            },
          });
        }}
      />
    </section>
  );
}
AssembliesPanel.displayName = "AssembliesPanel";
