/**
 * The bridge between the per-participant page matrix the invite drawer shows
 * and the resource+action grants the API enforces.
 *
 * The matrix is a UI convenience; authorization is resource+action. Keeping the
 * translation in one place is what stops a page being "hidden" in the sidebar
 * while the endpoint behind it still answers — which is exactly how a client
 * invited with "Finance details hidden by default" could still read the
 * contractor's cost position through the API.
 */

export type SectionValue = "hidden" | "view" | "edit";
export type ProjectSectionPermissions = Record<string, SectionValue>;

// The per-participant permission matrix (invite/edit drawer) uses dotted
// per-PAGE keys; backend auth uses resource+action. This is the single canonical
// bridge. `view`/`edit` grant only safe read/author actions — never manage,
// approve, decide or delete (those stay privileged, off the UI matrix).
const SECTION_MAP: Record<
  string,
  { resource: string; view: string[]; edit: string[]; viewExtra?: Record<string, string[]>; editExtra?: Record<string, string[]> }
> = {
  "projects.documents": { resource: "documents", view: ["view"], edit: ["view", "upload"] },
  "projects.schedule": {
    resource: "schedule",
    view: ["view"],
    edit: ["view", "manage"],
    viewExtra: { stages: ["view"], buildings: ["view"] },
    editExtra: { stages: ["view", "manage"], buildings: ["view", "manage"] },
  },
  "projects.bim": { resource: "bim", view: ["view"], edit: ["view", "upload"] },
  "quality.inspections": { resource: "inspections", view: ["view"], edit: ["view", "request"] },
  "quality.dailyLogs": { resource: "dailyLog", view: ["view", "report"], edit: ["view", "create", "report"] },
  "quality.risks": { resource: "risks", view: ["view"], edit: ["view"] },
  "commercial.finances": { resource: "finances", view: ["view"], edit: ["view"] },
  // Budget-vs-actual and purchase orders are the CONTRACTOR'S cost position;
  // seeing those pages is finances:viewCosts, not plain finances:view.
  "commercial.budget": { resource: "finances", view: ["view", "viewCosts"], edit: ["view", "viewCosts"] },
  "commercial.invoices": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.paymentClaims": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.purchaseOrders": { resource: "finances", view: ["view", "viewCosts"], edit: ["view", "viewCosts"] },
  "commercial.expenses": { resource: "finances", view: ["view", "viewCosts"], edit: ["view", "viewCosts"] },
  "commercial.materialsEquipment": { resource: "materials", view: ["view"], edit: ["view", "request"] },
  "commercial.materialsLedger": { resource: "materials", view: ["view", "report"], edit: ["view", "report"] },
  "workflow.rfis": { resource: "rfis", view: ["view"], edit: ["view", "create", "respond"], editExtra: { comments: ["view", "post"] } },
  "workflow.queries": { resource: "queries", view: ["view"], edit: ["view", "raise"], editExtra: { comments: ["view", "post"] } },
  "workflow.approvals": { resource: "approvals", view: ["view"], edit: ["view", "decide"], editExtra: { comments: ["view", "post"] } },
  "workflow.changeRequests": { resource: "change-requests", view: ["view"], edit: ["view"], editExtra: { comments: ["view", "post"] } },
  "workflow.actionItems": { resource: "action-items", view: ["view"], edit: ["view"], editExtra: { comments: ["view", "post"] } },
  "compliance.permits": { resource: "permits", view: ["view"], edit: ["view"] },
  "compliance.keyDates": { resource: "key-dates", view: ["view"], edit: ["view"] },
  "project.updates": { resource: "updates", view: ["view"], edit: ["view", "post"] },
  "collaboration.messaging": { resource: "messages", view: ["view"], edit: ["view", "send"] },
  "projects.selections": { resource: "selections", view: ["view"], edit: ["view", "decide"] },
};

// Fold a participant's section matrix into a resource->actions map. Sections
// sharing a resource union their actions; "hidden" contributes nothing. Only
// resources named by the matrix are affected — untouched resources fall through
// to the caller's precedence (role default).
export function sectionsToPermissions(
  sections: ProjectSectionPermissions,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(sections)) {
    const entry = SECTION_MAP[key];
    if (!entry || value === "hidden") continue;
    const actions = value === "edit" ? entry.edit : entry.view;
    out[entry.resource] = [...new Set([...(out[entry.resource] ?? []), ...actions])];
    if (entry.viewExtra) {
      for (const [res, extra] of Object.entries(entry.viewExtra)) {
        out[res] = [...new Set([...(out[res] ?? []), ...extra])];
      }
    }
    if (value === "edit" && entry.editExtra) {
      for (const [res, extra] of Object.entries(entry.editExtra)) {
        out[res] = [...new Set([...(out[res] ?? []), ...extra])];
      }
    }
  }
  return out;
}

// Actions the section matrix is capable of granting per resource (union of all
// view/edit bridges). The matrix may only revoke what it could have granted:
// actions outside this vocabulary (e.g. finances:dispute, materials:approve)
// stay governed by the participant's role default even when the matrix names
// the resource. editExtra grants are additive side-effects, never revocations.
const MATRIX_EXPRESSIBLE: Record<string, ReadonlySet<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const entry of Object.values(SECTION_MAP)) {
    const set = (map[entry.resource] ??= new Set());
    for (const action of [...entry.view, ...entry.edit]) set.add(action);
  }
  return map;
})();

/**
 * Effective participant permissions: role defaults overlaid with the
 * per-participant section matrix. When the matrix names a resource it is the
 * source of truth for that resource's matrix-expressible actions — "hidden"
 * genuinely revokes them. Resources (and non-expressible actions) the matrix
 * does not name fall through to the role default. Org permissions are NOT
 * composed here; callers keep them additive.
 */
export function composeParticipantPermissions(
  roleDefaults: Record<string, readonly string[]> | undefined,
  sections: ProjectSectionPermissions | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (sections) {
    for (const [res, actions] of Object.entries(sectionsToPermissions(sections))) {
      out[res] = [...actions];
    }
  }
  if (!roleDefaults) return out;

  const covered = new Set<string>();
  if (sections) {
    for (const key of Object.keys(sections)) {
      const entry = SECTION_MAP[key];
      if (entry) covered.add(entry.resource);
    }
  }
  for (const [resource, actions] of Object.entries(roleDefaults)) {
    const retained = covered.has(resource)
      ? actions.filter((action) => !MATRIX_EXPRESSIBLE[resource]?.has(action))
      : actions;
    if (retained.length > 0) {
      out[resource] = [...new Set([...(out[resource] ?? []), ...retained])];
    }
  }
  return out;
}
