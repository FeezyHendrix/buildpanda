import type { ProjectAccess } from "@/lib/project-types";

const ROLE_LABELS: Record<string, string> = {
  client: "homeowner",
  project_manager: "project manager",
  architect: "architect",
  inspector: "inspector",
  guest: "guest",
  materials_requester: "materials requester",
  materials_approver: "materials approver",
};

interface ReadOnlyBannerProps {
  access: ProjectAccess;
}

export function ReadOnlyBanner({ access }: ReadOnlyBannerProps) {
  const { relationship, orgRole } = access;

  if (relationship === "company" && access.capabilities.canManage) return null;

  let label: string;
  if (relationship === "company") {
    label = `You are viewing as a ${orgRole ?? "viewer"}. Changes are restricted.`;
  } else if (relationship !== "none") {
    const roleName = ROLE_LABELS[relationship] ?? relationship;
    label = `You are viewing as a ${roleName}. Some actions may be unavailable.`;
  } else {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 border-b border-amber-200">
      <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 5Zm0 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
      </svg>
      {label}
    </div>
  );
}
