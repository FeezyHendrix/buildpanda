import { useEffect, useMemo, useRef, useState } from "react";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateUpdate,
  useGenerateAiDraft,
  useProjectUpdates,
} from "@/hooks/use-updates";
import type { Person, ProjectUpdate } from "@/lib/project-types";

import { UpdateCard } from "./updates/update-card";
import {
  FiltersPanel,
  type FilterState,
  INITIAL_FILTERS,
} from "./updates/filters-panel";

export default function ProjectUpdates() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: updates = [] } = useProjectUpdates(project.id);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [focusDraftId, setFocusDraftId] = useState<string | null>(null);
  const draftsRef = useRef<HTMLElement | null>(null);
  const createUpdate = useCreateUpdate();
  const generateDraft = useGenerateAiDraft();

  const contractors = useMemo(() => uniqueContractors(updates), [updates]);
  const visible = useMemo(
    () => filterUpdates(updates, filters),
    [updates, filters],
  );
  const drafts = visible.filter((u) => u.isDraft);
  const published = visible.filter((u) => !u.isDraft);

  // Once the freshly generated draft lands in the list, bring it into view.
  useEffect(() => {
    if (focusDraftId && drafts.some((u) => u.id === focusDraftId)) {
      draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFocusDraftId(null);
    }
  }, [focusDraftId, drafts]);

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

  function handleGenerateDraft(): void {
    generateDraft.mutate(
      { projectId: project.id },
      { onSuccess: (draft) => setFocusDraftId(draft.id) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Updates"
        description="Track construction progress with real-time reports from the site."
        actions={
          canManage ? (
            <>
              <Button
                variant="secondary"
                loading={generateDraft.isPending}
                onClick={handleGenerateDraft}
              >
                <ReactSVG src={icons.aiVerify} />
                Draft with Panda AI
              </Button>
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                New update
              </Button>
            </>
          ) : null
        }
      />

      {generateDraft.isError ? (
        <p className="mt-3 text-sm text-red-600">
          {(generateDraft.error as Error).message}
        </p>
      ) : null}

      <UpsertUpdateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projectId={project.id}
        onSubmit={handleCreate}
        isSubmitting={createUpdate.isPending}
        error={(createUpdate.error as Error | undefined)?.message ?? null}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 relative mt-4">
        <div className="flex flex-col flex-1 gap-6 min-w-0">
          {canManage && drafts.length > 0 ? (
            <section ref={draftsRef} className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-semibold text-black-900">Drafts</h2>
                <p className="text-[13px] text-black-300">
                  Only your team can see drafts. Review, edit and publish to
                  share with the homeowner.
                </p>
              </div>
              {drafts.map((update) => (
                <UpdateCard
                  key={update.id}
                  projectId={project.id}
                  update={update}
                  canManage={canManage}
                />
              ))}
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            {canManage && drafts.length > 0 ? (
              <h2 className="text-sm font-semibold text-black-900">
                Published
              </h2>
            ) : null}
            {published.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-500">
                No updates match the current filters.
              </Card>
            ) : (
              published.map((update) => (
                <UpdateCard
                  key={update.id}
                  projectId={project.id}
                  update={update}
                  canManage={canManage}
                />
              ))
            )}
          </section>
        </div>

        <div className="w-full lg:w-[377px] lg:shrink-0 lg:sticky lg:top-8">
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
