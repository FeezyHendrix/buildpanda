import type { ProjectParticipant } from "@/lib/project-types";

export interface AssigneeChoice {
  /** Stable option key: `user:<id>`, `invited:<participantId>` or `contact:<id>`. */
  key: string;
  /** The signed-in user to assign to, or null for someone who has not accepted yet. */
  userId: string | null;
  name: string;
  email: string | null;
  invited: boolean;
}

/** "Engr. Bolanle Adeyemi (Resident Engineer, LSMW)" -> "BA". */
export function initialsFor(name: string): string {
  const cleaned = name
    // Drop parenthesised role/company and leading honorifics — "F(" is not a person.
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:mr|mrs|ms|miss|dr|engr|eng|arch|qs|sir|prof)\.?\s/gi, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

/**
 * Everyone who can hold a ball-in-court, a task or an inspection — including
 * people who have been invited but have not signed in yet. On a real job the PM
 * assigns work to the site agent the day he is added (findings F33 / #29).
 */
export function participantChoices(participants: readonly ProjectParticipant[]): AssigneeChoice[] {
  const choices: AssigneeChoice[] = [];
  for (const participant of participants) {
    if (participant.status === "revoked") continue;
    const name = participant.name ?? participant.email;
    const invited = participant.status === "invited";
    choices.push({
      key: participant.userId ? `user:${participant.userId}` : `invited:${participant.id}`,
      userId: participant.userId,
      name,
      email: participant.email,
      invited,
    });
  }
  return choices;
}

export function choiceLabel(choice: AssigneeChoice): string {
  return choice.invited ? `${choice.name} (invited)` : choice.name;
}
