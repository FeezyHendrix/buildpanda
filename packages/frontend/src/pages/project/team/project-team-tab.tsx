import { useMemo, useState } from "react";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { useParticipants } from "@/hooks/use-participants";
import type { ProjectParticipant } from "@/lib/project-types";
import { ParticipantRow } from "./participant-row";
import { TEAM_PAGE_SIZE, matchesTeamSearch, roleLabel, type TeamSort } from "./shared";
import { TeamToolbar } from "./team-toolbar";

/**
 * Everyone with access to this project. Search, role filter, order and paging
 * are done here over the full list, which the participants endpoint returns whole.
 */
export function ProjectTeamTab({
  projectId,
  onEdit,
}: {
  projectId: string;
  onEdit: (participant: ProjectParticipant) => void;
}) {
  const { data: participants = [] } = useParticipants(projectId);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [sort, setSort] = useState<TeamSort>("newest");
  const [page, setPage] = useState(1);

  const roles = useMemo(
    () => [...new Set(participants.map((p) => roleLabel(p.role)))].sort((a, b) => a.localeCompare(b)),
    [participants],
  );

  const filtered = useMemo(() => {
    const direction = sort === "newest" ? -1 : 1;
    return participants
      .filter((p) => matchesTeamSearch(p, search) && (!role || roleLabel(p.role) === role))
      .sort((a, b) => direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
  }, [participants, search, role, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / TEAM_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * TEAM_PAGE_SIZE, currentPage * TEAM_PAGE_SIZE);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <section className="mx-auto mt-[36px] w-full max-w-[954px]">
      <h2 className="text-[14px] font-semibold leading-[20px] text-[#1E1E1E]">Project Team</h2>
      <p className="mt-[2px] text-[12px] leading-[16px] text-[#737373]">People who can view or manage this project.</p>

      <div className="mt-[28px]">
        <TeamToolbar
          total={participants.length}
          search={search}
          onSearchChange={reset(setSearch)}
          roles={roles}
          role={role}
          onRoleChange={reset(setRole)}
          sort={sort}
          onSortChange={reset(setSort)}
        />
      </div>

      <div className="mt-[11px] border-t border-[#F7F7F7]">
        {visible.map((p) => (
          <ParticipantRow key={p.id} projectId={projectId} participant={p} onEdit={() => onEdit(p)} />
        ))}
        {filtered.length === 0 ? (
          <p className="px-[24px] py-8 text-center text-[14px] text-[#737373]">
            {participants.length === 0 ? "No one has access yet. Invite a member to get started." : "No one matches that search."}
          </p>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <div className="px-[24px] pb-[24px]">
          <NumberedPagination
            page={currentPage}
            pageSize={TEAM_PAGE_SIZE}
            total={filtered.length}
            noun="Team Members"
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}

ProjectTeamTab.displayName = "ProjectTeamTab";
