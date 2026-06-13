import { useMemo, useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CommentPanel } from "@/components/molecules/comment-panel";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useAddComment,
  useCreateUpdate,
  useDeleteUpdate,
  useEditUpdate,
  useProjectUpdates,
  useTransitionUpdate,
  useUpdateComments,
} from "@/hooks/use-updates";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import { UPDATE_CATEGORY_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  Person,
  ProjectUpdate,
  UpdateCategory,
  UpdateStatus,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

const CATEGORY_TARGET_STATUS: Record<UpdateCategory, Exclude<UpdateStatus, "Open">> = {
  Progress: "Approved",
  "Material Delivery": "Inspected",
  Inspections: "Approved",
  Issues: "Resolved",
};

const STATUS_BADGE_TONE: Record<
  Exclude<UpdateStatus, "Open">,
  "success" | "info" | "warning" | "danger"
> = {
  Approved: "success",
  Inspected: "info",
  Resolved: "success",
  Escalated: "warning",
};

type CategoryFilter = "All" | UpdateCategory;

const CATEGORY_FILTERS: CategoryFilter[] = [
  "All",
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
];

interface FilterState {
  category: CategoryFilter;
  contractor: string | null;
  dateFrom: string;
  dateTo: string;
}

const INITIAL_FILTERS: FilterState = {
  category: "All",
  contractor: null,
  dateFrom: "",
  dateTo: "",
};

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
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Updates"
        description="Track construction progress with real-time reports from the site."
        // actions={
        //   <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
        //     <PlusIcon className="size-4" />
        //     New update
        //   </Button>
        // }
      />

      <UpsertUpdateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createUpdate.isPending}
        error={(createUpdate.error as Error | undefined)?.message ?? null}
      />

      {/* <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]"> */}
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

function UpdateCard({
  projectId,
  update,
  canManage,
}: {
  projectId: string;
  update: ProjectUpdate;
  canManage: boolean;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const transition = useTransitionUpdate();
  const addComment = useAddComment();
  const editUpdate = useEditUpdate();
  const deleteUpdate = useDeleteUpdate();
  const commentsQuery = useUpdateComments(
    commentsOpen ? projectId : undefined,
    commentsOpen ? update.id : undefined,
  );

  const isOpen = update.status === "Open";
  const targetStatus = CATEGORY_TARGET_STATUS[update.category];

  function handleTransition(): void {
    if (!isOpen || transition.isPending) return;
    transition.mutate({
      projectId,
      updateId: update.id,
      status: targetStatus,
    });
  }

  function handlePostComment(body: string): void {
    addComment.mutate({ projectId, updateId: update.id, body });
  }

  function handleEdit(values: UpsertUpdateValues): void {
    editUpdate.mutate(
      { projectId, updateId: update.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteUpdate.mutate({ projectId, updateId: update.id });
  }

  return (
    <Card className="flex flex-col gap-4 border border-[#F6F6F6] rounded-[8px] p-[24px]">
      <header className="flex items-center justify-between">
        <div className="flex gap-2">
          <Avatar
            name={update.author.name}
            src={update.author.avatarUrl}
            size="md"
            className={cn("h-[40px] w-[40px] rounded-[12px]")}
          />
          <div>
            <p className="text-[#131B2E] font-semibold text-[13px]">
              {update.author.name}
            </p>
            <p className="text-black-300 text-[13px]">
              {update.author.role} · {formatDateTime(update.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {update.status !== "Open" && (
            <Badge tone={STATUS_BADGE_TONE[update.status]} size="md" dot>
              {update.status}
            </Badge>
          )}
          <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="md">
            {update.category}
          </Badge>
        </div>
      </header>

      <div className='flex flex-col gap-6'>
        <div>
          <h3 className="font-semibold text-[#131B2E]">
            {update.title}
          </h3>
          <p className="text-[13px] text-black-300">
            {update.description}
          </p>
          {!isOpen && update.action.takenBy && update.action.takenAt && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              {update.status} by {update.action.takenBy.name} ·{" "}
              {formatTimeAgo(update.action.takenAt)}
            </p>
          )}
        </div>
        <MediaGallery items={update.media} />
      </div>


      <footer className='flex justify-between items-center border-t border-[#F6F6F6] pt-6'>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCommentsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black-300 hover:text-black-500 cursor-pointer p-0"
          >
            <ReactSVG src={icons.comment} />
            <p>{commentsOpen ? "Hide comments" : "Comment"}</p>
          </button>
          {update.secondaryAction && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-black-300 hover:text-black-500 p-0 cursor-pointer"
            >
              {update.secondaryAction.label === 'View Report' && <ReactSVG src={icons.report} />}
              {update.secondaryAction.label === 'Escalation Details' && <ReactSVG src={icons.warningCircle} />}
              {update.secondaryAction.label === 'Verify with Panda AI' && <ReactSVG src={icons.aiVerify} />}
              <p>{update.secondaryAction.label}</p>
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-medium text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
        {canManage && (
          <Button
            size="sm"
            variant={update.cta.tone === "primary" ? "primary" : "secondary"}
            disabled={!isOpen || transition.isPending}
            onClick={handleTransition}
          >
            {transition.isPending
              ? "Submitting…"
              : !isOpen
                ? update.status
                : update.cta.label}
          </Button>
        )}
      </footer>

      {commentsOpen && (
        <CommentPanel
          comments={commentsQuery.data ?? []}
          isLoading={commentsQuery.isLoading}
          isSubmitting={addComment.isPending}
          onSubmit={handlePostComment}
        />
      )}

      <UpsertUpdateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          category: update.category,
          title: update.title,
          description: update.description,
          media: update.media.map((m) => ({ type: m.type, url: m.url })),
        }}
        onSubmit={handleEdit}
        isSubmitting={editUpdate.isPending}
        error={(editUpdate.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete update"
        description="This permanently removes the update and its comments. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}

interface FiltersPanelProps {
  filters: FilterState;
  contractors: Pick<Person, "id" | "name" | "role">[];
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

function FiltersPanel({ filters, contractors, onChange }: FiltersPanelProps) {
  return (
    <aside className="h-fit lg:sticky lg:top-24 rounded-[16px] bg-[#F8F8F8] flex flex-col">
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.filter} />
          <h3 className="text-[13px] font-semibold text-black-300">Filter Menu</h3>
        </div>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6 flex flex-col gap-4">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Categories
          </h3>
          <div className="flex flex-wrap gap-4">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange("category", c)}
                className={cn(
                  "flex items-center justify-between rounded-[15px] px-[10px] py-[4px] text-[13px] h-[24px] bg-[#F6F6F6] transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 cursor-pointer",
                  filters.category === c
                    ? "bg-primary-50 font-semibold text-primary"
                    : "text-black-300 hover:bg-primary-50 hover:text-primary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className='border-t border-[#F6F6F6] pt-6'>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Contractors
          </h3>
          <div className="flex flex-col gap-1">
            {contractors.map((c) => (
              <RadioRow
                key={c.id}
                label={c.name}
                sublabel={c.role}
                checked={filters.contractor === c.id}
                onChange={() => onChange("contractor", c.id)}
              />
            ))}
          </div>
        </div>

        <div className='border-t border-[#F6F6F6] pt-6'>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Date Range
          </h3>
          <div className="flex flex-row justify-between items-center">
            <DateField
              // label="From"
              value={filters.dateFrom}
              onChange={(v) => onChange("dateFrom", v)}
            />
            <span>-</span>
            <DateField
              // label="To"
              value={filters.dateTo}
              onChange={(v) => onChange("dateTo", v)}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

interface RadioRowProps {
  label: string;
  img?: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}

function RadioRow({ label, img, sublabel, checked, onChange }: RadioRowProps) {
  return (
    <label
      className={cn(
        "flex justify-between cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#F6F6F6]",
        checked && "bg-[#F6F6F6]",
      )}
    >
      <div className='flex gap-2'>
        <Avatar
          name={label}
          src={img}
          size="md"
          className={cn("h-[34px] w-[34px] rounded-[8px]")}
        />
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-[#131B2E]">
            {label}
          </span>
          {sublabel && (
            <span className="block truncate text-[11px] text-black-300">
              {sublabel}
            </span>
          )}
        </span>
      </div>
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-[#004DE7]" : "border-gray-300",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-[#004DE7]" />}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
      />
    </label>
  );
}
