import { composeParticipantPermissions, PARTICIPANT_PERMISSIONS } from "../../lib/authorization.ts";
import { ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ApproverCandidate, ApprovalsRepository } from "./repository.ts";
import { DEFAULT_APPROVAL_CATEGORIES, type ApprovalCategory, type Approver } from "./types.ts";
import type { ApprovalProject } from "./service.ts";

/** Who may decide: mirrors computeAccess's canDecideApprovals. */
export function mayDecide(c: ApproverCandidate): boolean {
  if (c.org_role) return c.org_role !== "viewer";
  if (c.participant_role === "client") return true;
  const grants =
    c.grants && Object.keys(c.grants).length > 0
      ? c.grants
      : composeParticipantPermissions(
          c.participant_role ? PARTICIPANT_PERMISSIONS[c.participant_role] : undefined,
          c.permissions && Object.keys(c.permissions).length > 0 ? (c.permissions as never) : undefined,
        );
  return (grants["approvals"] ?? []).includes("decide");
}

export function approverRules(repository: ApprovalsRepository) {
  async function approvers(project: ApprovalProject): Promise<Approver[]> {
    const seen = new Set<string>();
    const out: Approver[] = [];
    for (const c of await repository.approverCandidates(project.id, project.organizationId, project.ownerId)) {
      if (seen.has(c.id) || !mayDecide(c)) continue;
      seen.add(c.id);
      out.push({ id: c.id, name: c.name, role: c.org_role ? "company" : (c.participant_role ?? "participant") });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function reviewerOrDeciders(project: ApprovalProject, requestedReviewerId: string | null | undefined): Promise<string[]> {
    const deciders = await approvers(project);
    if (requestedReviewerId) {
      if (!deciders.some((d) => d.id === requestedReviewerId)) {
        throw new ValidationError("That person cannot decide approvals on this project", { fields: { requestedReviewerId: "not_an_approver" } });
      }
      return [requestedReviewerId];
    }
    return deciders.map((d) => d.id);
  }

  return { approvers, reviewerOrDeciders };
}

export function approvalCategories(repository: ApprovalsRepository) {
  return {
    async list(projectId: string): Promise<ApprovalCategory[]> {
      const rows = await repository.listCategories(projectId);
      if (rows.length > 0) return rows.map((r) => ({ id: r.id, name: r.name }));
      return DEFAULT_APPROVAL_CATEGORIES.map((name) => ({ id: name.toLowerCase(), name }));
    },

    async replace(projectId: string, names: string[]): Promise<ApprovalCategory[]> {
      const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
      await repository.replaceCategories(
        clean.map((name, position) => ({ id: generateId("aprcat"), project_id: projectId, name, position })),
        projectId,
      );
      return this.list(projectId);
    },
  };
}
