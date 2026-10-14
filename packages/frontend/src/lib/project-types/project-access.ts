

export type KnownParticipantRole =
  | "client"
  | "project_manager"
  | "architect"
  | "inspector"
  | "guest"
  | "materials_requester"
  | "materials_approver";
export type ParticipantRole = KnownParticipantRole | (string & {});
export type ParticipantStatus = "invited" | "active" | "revoked";

/**
 * Which side of the contract a person sits on. It decides who can be
 * ball-in-court on an RFI, who approves a valuation and who signs an
 * inspection — a "Client" role label alone never said (finding #14).
 */
export const PARTICIPANT_SIDES = ["client", "contractor", "consultant"] as const;
export type ParticipantSide = (typeof PARTICIPANT_SIDES)[number];
export type SectionPermission = "hidden" | "view" | "edit";
export type ParticipantPermissions = Record<string, SectionPermission>;

export interface ProjectParticipant {
  id: string;
  projectId: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: ParticipantRole | "owner";
  side: ParticipantSide | null;
  status: ParticipantStatus;
  permissions: ParticipantPermissions;
  grants: Record<string, string[]> | null;
  createdAt: string;
}

export interface ProjectAccess {
  userId?: string;
  projectId?: string;
  organizationId?: string | null;
  relationship: "company" | ParticipantRole | "none";
  orgRole: string | null;
  /** Effective resource permissions (org role ∪ participant overlay), e.g. { finances: ["view"] }. */
  permissions: Record<string, string[]>;
  /**
   * Per-participant page-access matrix (dotted section key -> hidden|view|edit),
   * or null when the participant has no explicit matrix (falls back to role
   * defaults). When present it is the source of truth for per-page visibility.
   */
  sections: Record<string, "hidden" | "view" | "edit"> | null;
  capabilities: {
    canManage: boolean;
    canViewAll: boolean;
    canManageParticipants: boolean;
    canDecideApprovals: boolean;
    canDecideSelections: boolean;
    /**
     * The cost position is the contractor's own — expenses, purchase orders,
     * budget vs actual, cost variance. A client-side participant sees the
     * contract they are party to and never the costs behind it.
     */
    canViewCosts: boolean;
    canComment: boolean;
  };
}

/**
 * Whether a nav entry / page is visible. The effective RBAC map
 * (`access.permissions`) is the single source of truth: the backend already
 * folds org role, participant role defaults and the per-participant section
 * matrix (including `hidden` revocation) into it, so visibility here matches
 * exactly what the API authorizes. Entries without a resource are unrestricted.
 * Presentation only — backend enforces regardless.
 */
export function canViewSection(
  access: ProjectAccess | undefined,
  _sectionKey: string | undefined,
  resource?: string,
  /** The action the section needs; `view` when omitted (cost pages pass `viewCosts`). */
  action?: string,
): boolean {
  if (!resource) return true;
  if (!access) return false;
  if (!action || action === "view") return canViewResource(access, resource);
  return canResourceAction(access, resource, action);
}

/**
 * Whether the caller may view a permissioned resource. Entries without a
 * resource are unrestricted. Protected resources remain hidden until access is known.
 */
export function canViewResource(
  access: ProjectAccess | undefined,
  resource?: string,
): boolean {
  if (!resource) return true;
  if (!access) return false;
  return (access.permissions?.[resource] ?? []).includes("view");
}

/**
 * Whether the caller has the exact action grant enforced by the backend.
 * Presentation only — the backend enforces regardless.
 */
export function canResourceAction(
  access: ProjectAccess | undefined,
  resource: string,
  action: string,
): boolean {
  if (!access) return false;
  const actions = access.permissions?.[resource] ?? [];
  return actions.includes(action);
}
