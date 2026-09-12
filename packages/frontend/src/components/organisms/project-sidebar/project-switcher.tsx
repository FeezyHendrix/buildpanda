import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/use-projects";
import type { Project } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/** Route tails that exist on every project; anything deeper falls back to the overview. */
const SWITCHABLE_TAILS = new Set([
  "overview", "updates", "tasks", "chat", "settings", "team", "documents", "plans", "daily-log",
  "rfis", "change-requests", "materials", "finances", "activities", "look-aheads", "key-dates", "stages",
]);

function targetFor(pathname: string, fromId: string, toId: string): string {
  const tail = pathname.split(`/project/${fromId}/`)[1]?.split("/")[0];
  return `/project/${toId}/${tail && SWITCHABLE_TAILS.has(tail) ? tail : "overview"}`;
}

/**
 * Ernest's sidebar project switcher: the current project as a dark pill; a
 * searchable list of the workspace's projects opens under it and switching
 * keeps the same section where it exists on the other project.
 */
export function ProjectSwitcher({ project, onClose }: { project: Project; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Switch project"
        className="flex w-full items-center gap-2 bg-white/10 py-3 pl-6 pr-5 text-left outline-none transition-colors hover:bg-white/30 focus-visible:bg-white/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink-inverted">{project.name}</span>
          {project.address ? (
            <span className="block truncate text-sm text-ink-muted">{project.address}</span>
          ) : null}
        </span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 shrink-0 text-ink-disabled">
          <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg border border-line bg-white p-2 shadow-card">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className="mb-1 h-[38px] w-full rounded-lg border border-line px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-500 focus:shadow-focus"
          />
          <ul className="max-h-72 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">No projects match</li>
            ) : (
              matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      onClose?.();
                      if (p.id !== project.id) navigate(targetFor(location.pathname, project.id, p.id));
                    }}
                    className={cn(
                      "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-black/5",
                      p.id === project.id && "bg-black/5 font-medium",
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
ProjectSwitcher.displayName = "ProjectSwitcher";
