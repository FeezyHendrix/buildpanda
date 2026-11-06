import type { ProjectParticipant } from "@/lib/project-types";

export const TEAM_PAGE_SIZE = 10;

export type TeamTabId = "team" | "contacts";
export const TEAM_TABS: readonly { id: TeamTabId; label: string }[] = [
  { id: "team", label: "Project Team" },
  { id: "contacts", label: "Contacts" },
];

export type TeamSort = "newest" | "oldest";

export const SIDE_LABEL: Record<NonNullable<ProjectParticipant["side"]>, string> = {
  client: "Client side",
  contractor: "Contractor side",
  consultant: "Consultant",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  client: "Client",
  architect: "Architect",
  inspector: "Inspector",
  guest: "Guest",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/**
 * A real display name only when it is present and not just a copy of the email,
 * so a row shows "name / email" and never "email / email".
 */
export function displayName(participant: ProjectParticipant): string | null {
  const name = participant.name?.trim();
  if (!name || name.toLowerCase() === participant.email.toLowerCase()) return null;
  return name;
}

export function matchesTeamSearch(participant: ProjectParticipant, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${participant.name ?? ""} ${participant.email}`.toLowerCase().includes(needle);
}
