import { useDeferredValue, useMemo, useState } from "react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useCreateUpdate,
  useGenerateAiDraft,
  useProjectUpdates,
} from "@/hooks/use-updates";
import { canResourceAction, type ProjectUpdate } from "@/lib/project-types";
import { cn } from "@/lib/utils";

import { TextInput } from "@/components/atoms/text-input";

import { UpdateCard } from "./updates/update-card";
import {
  FiltersPanel,
  CATEGORY_FILTERS,
  type FilterState,
} from "./updates/filters-panel";
import { icons2 } from "@/assets/icons2/icon2";

type Tab = "published" | "drafts";

function matchesSearch(update: ProjectUpdate, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  return (
    update.title.toLowerCase().includes(query) ||
    update.description.toLowerCase().includes(query) ||
    update.author.name.toLowerCase().includes(query) ||
    update.category.toLowerCase().includes(query)
  );
}

export default function ProjectUpdates() {
  useSetPageTitle(
    "Updates",
    "Track construction progress with real-time reports from the site.",
  );

  const { project, access } = useProjectContext();
  const canPost = Boolean(access && canResourceAction(access, "updates", "post"));
  const canManage = canPost;
  const { data: updates = [] } = useProjectUpdates(project.id);

  const [tab, setTab] = useState<Tab>("published");
  const [category, setCategory] = useState<FilterState["category"]>("All");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [autoEditDraftId, setAutoEditDraftId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const createUpdate = useCreateUpdate();
  const generateDraft = useGenerateAiDraft();

  const visible = useMemo(() => {
    return updates.filter((u) => {
      if (category !== "All" && u.category !== category) return false;
      if (!matchesSearch(u, deferredSearch)) return false;
      const created = new Date(u.createdAt);
      if (appliedFrom && created < new Date(appliedFrom)) return false;
      if (appliedTo && created > new Date(appliedTo)) return false;
      return true;
    });
  }, [updates, category, deferredSearch, appliedFrom, appliedTo]);

  const drafts = visible.filter((u) => u.isDraft);
  const published = visible.filter((u) => !u.isDraft);
  const shown = tab === "published" ? published : drafts;

  function handleCreate(values: UpsertUpdateValues): void {
    createUpdate.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleGenerateDraft(): void {
    generateDraft.mutate(
      { projectId: project.id },
      {
        onSuccess: (draft) => {
          setTab("drafts");
          setAutoEditDraftId(draft.id);
        },
      },
    );
  }

  function applyFilter() {
    setAppliedFrom(filterDateFrom);
    setAppliedTo(filterDateTo);
  }

  function resetFilter() {
    setFilterDateFrom("");
    setFilterDateTo("");
    setAppliedFrom("");
    setAppliedTo("");
  }

  return (
    <div className="w-full px-4 lg:px-10 py-8 sm:px-10">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center border-[0.5px] border-border bg-white">
          <button
            type="button"
            onClick={() => setTab("published")}
            className={cn(
              "h-9 px-4 text-[13px] font-medium transition-colors",
              tab === "published"
                ? "bg-primary text-white"
                : "text-[#131B2E] hover:bg-black/5",
            )}
          >
            Published
          </button>
          <button
            type="button"
            onClick={() => setTab("drafts")}
            className={cn(
              "h-9 px-4 text-[13px] font-medium transition-colors",
              tab === "drafts"
                ? "bg-primary text-white"
                : "text-[#131B2E] hover:bg-black/5",
            )}
          >
            Drafts
            {drafts.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[11px]",
                  tab === "drafts"
                    ? "bg-white text-primary font-semibold"
                    : "bg-primary text-white",
                )}
              >
                {drafts.length}
              </span>
            )}
          </button>
        </div>

        {canPost && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="lg"
              loading={generateDraft.isPending}
              onClick={handleGenerateDraft}
            >
              <ReactSVG src={icons2.stars} className="shrink-0" />
              Draft with Panda AI
            </Button>
            <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
              <ReactSVG src={icons2.plus} className="[&_svg]:size-[14px] [&_path]:fill-white shrink-0" />
              New Update
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 relative mt-6">
        {/* Main content */}
        <div className="flex flex-col flex-1 gap-6 min-w-0">
          {/* Category filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors border-[0.5px]",
                  category === c
                    ? "bg-black-500 text-white border-none"
                    : "bg-white text-black-500 border-border",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Update list */}
          <div className="flex flex-col">
            {shown.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-black-300">
                {tab === "drafts" ? "No drafts yet." : "No updates match the current filters."}
              </p>
            ) : (
              shown.map((update) => (
                <UpdateCard
                  key={update.id}
                  projectId={project.id}
                  update={update}
                  canManage={canManage}
                  autoEdit={update.id === autoEditDraftId}
                  onAutoEditHandled={() => setAutoEditDraftId(null)}
                />
              ))
            )}
          </div>
        </div>

        {/* Search + filter panel */}
        <div className="flex w-full flex-col gap-4 lg:w-[280px] lg:shrink-0 lg:sticky lg:top-8">
          <div className="relative">
            <ReactSVG src={icons2.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]" />
            <TextInput
              type="text"
              placeholder="Search updates..."
              value={search}
              onChange={setSearch}
              aria-label="Search updates"
              className="h-10 indent-8"
            />
          </div>
          <FiltersPanel
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
            onApply={applyFilter}
            onReset={resetFilter}
          />
        </div>
      </div>

      <UpsertUpdateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projectId={project.id}
        onSubmit={handleCreate}
        isSubmitting={createUpdate.isPending}
        error={(createUpdate.error as Error | undefined)?.message ?? null}
      />
    </div>
  );
}
