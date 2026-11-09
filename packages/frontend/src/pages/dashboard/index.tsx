import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/atoms/dropdown-menu";
import { EmptyState } from "@/components/molecules/empty-state";
import { PendingInvitesBanner } from "@/components/molecules/pending-invites-banner";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { useProjectPage } from "@/hooks/use-projects";
import { useHasOrgPermission } from "@/hooks/use-organization";
import { useSession } from "@/stores/auth";
import emptyIcon from "@/assets/images/empty-dashboard.svg";
import { icons2 } from "@/assets/icons2/icon2";
import { ReactSVG } from "react-svg";
import { DashboardToolbar } from "./dashboard-toolbar";
import { ProjectCard } from "./project-card";
import {
  NO_PROJECT_FILTERS,
  isFiltering,
  type ProjectFilters,
  type ProjectSort,
} from "./project-filters";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const PAGE_SIZE = 12;
const SORT_PARAM: Record<ProjectSort, "recent" | "name_asc" | "name_desc" | "newest" | "oldest"> = {
  recent: "recent",
  "name-asc": "name_asc",
  "name-desc": "name_desc",
  newest: "newest",
  oldest: "oldest",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const canCreateProject = useHasOrgPermission("project", "create");
  const [filters, setFilters] = useState<ProjectFilters>(NO_PROJECT_FILTERS);
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [page, setPage] = useState(1);
  // The server searches, filters by creation date, sorts and pages (docs/dashboard-page-backend.md).
  const { data, isPending } = useProjectPage({
    q: filters.search.trim() || undefined,
    createdFrom: filters.from || undefined,
    createdTo: filters.to || undefined,
    sort: SORT_PARAM[sort],
    page,
    pageSize: PAGE_SIZE,
  });
  const greeting = getGreeting(new Date().getHours());
  const firstName = (session?.user?.name ?? "").trim().split(" ")[0];

  if (isPending) return <LoadingSpinner />;

  const total = data?.total ?? 0;
  const pageItems = data?.items ?? [];

  if (total === 0 && !isFiltering(filters)) {
    return canCreateProject ? (
      <DashboardEmptyState onCreate={() => navigate("/project/create")} />
    ) : (
      <NoAssignedProjectsState />
    );
  }

  const shown = pageItems;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-12 pt-[52px] lg:px-10">
      <div className="mb-6">
        <PendingInvitesBanner />
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-h5 font-semibold !text-[#686868]">
            {greeting}
            {firstName && <span className="text-black">, {firstName}</span>}
          </h5>
          <p className="mt-1 text-caption-m font-medium text-black-500 opacity-50">
            {total} project{total !== 1 ? "s" : ""} available
          </p>
        </div>

        {canCreateProject && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="primary" size="lg" className="shrink-0 gap-2 pr-0" aria-label="New project options">
                  <Plus className="size-[16px]" strokeWidth={1.75} aria-hidden />
                  New Project
                  <span className="ml-1 flex h-full w-[27px] items-center justify-center border-l border-white/25">
                    <ChevronDown className="size-[14px]" aria-hidden />
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-[380px] p-2">
              <DropdownMenuItem onSelect={() => navigate("/project/create")} className="flex items-center gap-2">
                <ReactSVG src={icons2.folderAdd} />
                <div className="flex flex-col">
                  <span className="text-caption-l font-semibold text-black-700">Start a New project</span>
                  <span className="text-caption-m font-medium text-grey-450">Spin up a new construction project from scratch</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/import")} className="flex items-center gap-2">
                <ReactSVG src={icons2.folderImport} />
                <div className="flex flex-col">
                  <span className="text-caption-l font-semibold text-black-700">Import Project</span>
                  <span className="text-caption-m font-medium text-grey-450">Import a programme, BOQ, drawings or BIM and we'll build the project for you</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-[40px]">
        <DashboardToolbar
          filters={filters}
          onFiltersChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </div>

      {shown.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            variant="inline"
            title="No projects match"
            description="Try a different name, or widen the dates."
            action={
              isFiltering(filters)
                ? { label: "Clear filters", onClick: () => setFilters(NO_PROJECT_FILTERS) }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-x-[23px] gap-y-[21px] sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          <div className="mt-[32px]">
            <NumberedPagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={total}
              noun="Projects"
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Loading / empty states ────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center pt-32">
      <Spinner size="lg" />
    </div>
  );
}

function DashboardEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-10">
      <div className="w-full max-w-2xl px-4">
        <PendingInvitesBanner />
      </div>
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-90" />}
        title="Welcome to your workspace!"
        description="Your workspace is empty for now. Create your first project and start planning, building and collaborating with your team"
        action={
          <Button
            variant="primary"
            size="lg"
            className="text-base font-semibold w-full"
            onClick={onCreate}
          >
            Create your first project
          </Button>
        }
      />
    </div>
  );
}

function NoAssignedProjectsState() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-10">
      <div className="w-full max-w-2xl px-4">
        <PendingInvitesBanner />
      </div>
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="No projects yet"
        description="You'll see a project here as soon as your team adds you to one. Check back shortly or ask your workspace admin for access."
      />
    </div>
  );
}
