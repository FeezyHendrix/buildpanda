import { useMemo, useState } from "react";
import { Card } from "@/components/atoms/card";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateUpdate,
  useProjectUpdates,
} from "@/hooks/use-updates";
import type {
  Person,
  ProjectUpdate,
} from "@/lib/project-types";

import { UpdateCard } from "./updates/update-card";
import { FiltersPanel, type FilterState, INITIAL_FILTERS } from "./updates/filters-panel";

export default function ProjectUpdates() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: updates = [] } = useProjectUpdates(project.id);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const createUpdate = useCreateUpdate();

  const contractors = useMemo(() => uniqueContractors(updates), [updates]);
  const visible = useMemo(
    () => filterUpdates(updates, filters),
    [updates, filters],
  );

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  function handleCreate(values: UpsertUpdateValues): void {
    createUpdate.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Updates"
        description="Track construction progress with real-time reports from the site."
      />

      <UpsertUpdateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createUpdate.isPending}
        error={(createUpdate.error as Error | undefined)?.message ?? null}
      />

      <div className='flex items-start gap-8 relative mt-4'>
        <section className="flex flex-col flex-1 gap-4 min-w-0">
          {visible.length === 0 ? (
            <Card padding="lg" className="text-center text-sm text-gray-500">
              No updates match the current filters.
            </Card>
          ) : (
            visible.map((update) => (
              <UpdateCard
                key={update.id}
                projectId={project.id}
                update={update}
                canManage={canManage}
              />
            ))
          )}
        </section>

        <div className="w-[377px] shrink-0 sticky top-8">
          <FiltersPanel
            filters={filters}
            contractors={contractors}
            onChange={updateFilter}
          />
        </div>
      </div>
    </div>
  );
}

function uniqueContractors(
  updates: ProjectUpdate[],
): Pick<Person, "id" | "name" | "role">[] {
  const seen = new Map<string, Pick<Person, "id" | "name" | "role">>();
  for (const update of updates) {
    if (!seen.has(update.author.id)) {
      seen.set(update.author.id, {
        id: update.author.id,
        name: update.author.name,
        role: update.author.role,
      });
    }
  }
  return Array.from(seen.values());
}

function filterUpdates(
  updates: ProjectUpdate[],
  filters: FilterState,
): ProjectUpdate[] {
  return updates.filter((u) => {
    if (filters.category !== "All" && u.category !== filters.category)
      return false;
    if (filters.contractor && u.author.id !== filters.contractor) return false;
    const created = new Date(u.createdAt);
    if (filters.dateFrom && created < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && created > new Date(filters.dateTo)) return false;
    return true;
  });
}
