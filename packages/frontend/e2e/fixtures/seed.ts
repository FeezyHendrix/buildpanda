import { ApiClient } from "./api-client";
import { db } from "./db";
import { generateId, uniqueName } from "./ids";

export interface SeededProject {
  id: string;
  title: string;
}

// Creates a project through the API for an already-authenticated owner. Mirrors
// the wizard's required payload shape exactly (title/type/location/details/
// management). The backend assigns the id (generateId("prj")) and bootstraps the
// org + default board, so we never fabricate project ids.
// ASSUMPTION (A5): the owner's active org is already provisioned by the session
// hook (ensureUserOrganization), so this passes requireOrgPermission.
export async function seedProject(api: ApiClient, titleBase = "E2E Project"): Promise<SeededProject> {
  const title = uniqueName(titleBase);
  const project = await api.postOrThrow<{ id: string; title: string }>("/projects", {
    title,
    projectType: "Residential",
    location: { state: "Lagos", city: "Lagos", ownsLand: true },
    details: {
      buildingType: "Villa",
      currency: "NGN",
      budgetMin: 1_000_000,
      budgetMax: 5_000_000,
      timeline: "6 months",
      fundingMethod: "Self-funded",
    },
    management: { involvementLevel: "hands_on", riskOptions: [] },
  });
  return { id: project.id, title: project.title ?? title };
}

// Logical teardown: archive/delete the project via the API so child records go
// with it (FK cascade), even if a spec failed mid-flow. Never throws — teardown
// must run to completion.
export async function teardownProject(api: ApiClient, projectId: string): Promise<void> {
  try {
    await api.delete(`/projects/${projectId}`);
  } catch {
    // Best-effort; a failed teardown should not mask the spec result.
  }
}

// Makes another user an ACTIVE participant of a project, bypassing the email
// invite/token round-trip by inserting the project_participants row directly
// (auth-context loads projectRoles from active participants by user_id, so this
// is exactly what an accepted invite produces). Role defaults to "client", whose
// capabilities are additive-view only — the basis for the cross-role read-only
// permission test. Returns the participant row id for teardown.
export async function shareProjectWithParticipant(
  projectId: string,
  participant: { userId: string; email: string },
  invitedById: string,
  role = "client",
): Promise<string> {
  const id = generateId("pp");
  await db()("project_participants").insert({
    id,
    project_id: projectId,
    user_id: participant.userId,
    email: participant.email.toLowerCase(),
    role,
    status: "active",
    invited_by_id: invitedById,
  });
  return id;
}

