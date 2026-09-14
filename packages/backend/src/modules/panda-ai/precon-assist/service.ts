import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { isLlmConfigured } from "../../../lib/llm.ts";
import type { PreconRepository } from "../pdf-takeoff/repository.ts";
import { applyChange, permissionFor, undoChange, type LiveState, type PreconService } from "./applier.ts";
import {
  defaultDraftLlm,
  messagesFor,
  normaliseBillChanges,
  normaliseProgrammeChanges,
  type BillContext,
  type DraftLlm,
  type ProgrammeContext,
} from "./planner.ts";
import type { PreconAssistRepository } from "./repository.ts";
import {
  SUPPORTED_SURFACES,
  type AppliedChange,
  type AppliedResult,
  type AssistRequestBody,
  type AssistSurface,
  type CanFn,
  type ChangeSet,
  type ChangeSetRow,
  type AssistViewerContext,
} from "./types.ts";

export interface PreconAssistDeps {
  precon: PreconService;
  preconRepo: Pick<PreconRepository, "insertAuditEvent">;
  llm?: DraftLlm;
  llmConfigured?: () => boolean;
}

function toChangeSet(r: ChangeSetRow): ChangeSet {
  return {
    id: r.id,
    sessionId: r.session_id,
    proposalId: r.proposal_id,
    surface: r.surface,
    prompt: r.prompt,
    plan: r.plan_json,
    changes: r.changes,
    status: r.status,
    appliedResult: r.applied_result,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
  };
}

export function preconAssistService(repo: PreconAssistRepository, deps: PreconAssistDeps) {
  const llm = deps.llm ?? defaultDraftLlm;
  const configured = deps.llmConfigured ?? isLlmConfigured;

  async function loadContext(surface: AssistSurface, sessionId: string, viewer?: AssistViewerContext): Promise<BillContext | ProgrammeContext> {
    if (surface === "bill") {
      const snapshot = await deps.precon.getSnapshot(sessionId);
      return { bills: snapshot.bills, rows: snapshot.rows, sheets: snapshot.sheets, viewer };
    }
    const programme = await deps.precon.getProgramme(sessionId);
    return { tasks: programme.tasks };
  }

  async function loadLive(surface: AssistSurface, sessionId: string): Promise<LiveState> {
    const ctx = await loadContext(surface, sessionId);
    return {
      sessionId,
      rows: new Map("rows" in ctx ? ctx.rows.map((r) => [r.id, r]) : []),
      tasks: new Map("tasks" in ctx ? ctx.tasks.map((t) => [t.id, t]) : []),
    };
  }

  async function audit(set: ChangeSetRow, actor: string, action: string, after: Record<string, unknown>): Promise<void> {
    if (!set.session_id) return;
    await deps.preconRepo.insertAuditEvent({
      id: generateId("pae"),
      session_id: set.session_id,
      row_id: null,
      actor,
      action,
      before: null,
      after: { changeSetId: set.id, prompt: set.prompt, via: "Panda AI prompt", ...after },
    });
  }

  async function loadOwned(id: string, orgId: string): Promise<ChangeSetRow> {
    const set = await repo.byId(id);
    if (!set) throw new NotFoundError("Change set");
    if (set.session_id) await deps.precon.assertSessionOrg(set.session_id, orgId);
    else throw new NotFoundError("Change set");
    return set;
  }

  return {
    async propose(body: AssistRequestBody, actor: string, orgId: string): Promise<ChangeSet> {
      if (!SUPPORTED_SURFACES.includes(body.surface)) {
        throw new BadRequestError(`Ask Panda AI is not available on the ${body.surface} yet`);
      }
      if (!body.sessionId) throw new BadRequestError("A take-off session is required for this surface");
      await deps.precon.assertSessionOrg(body.sessionId, orgId);
      if (!configured()) throw new BadRequestError("Panda AI is not configured on this server");

      const ctx = await loadContext(body.surface, body.sessionId, body.context);
      const draft = await llm(messagesFor(body.surface, body.prompt, ctx));
      if (!draft) throw new BadRequestError("Panda AI did not return a plan. Try rephrasing the request.");
      const changes =
        body.surface === "bill"
          ? normaliseBillChanges(draft, ctx as BillContext)
          : normaliseProgrammeChanges(draft, ctx as ProgrammeContext);

      const row = await repo.insert({
        id: generateId("pcc"),
        session_id: body.sessionId,
        proposal_id: body.proposalId ?? null,
        surface: body.surface,
        prompt: body.prompt,
        plan_json: draft.plan,
        changes,
        status: "proposed",
        created_by: actor,
      });
      return toChangeSet(row);
    },

    async get(id: string, orgId: string): Promise<ChangeSet> {
      return toChangeSet(await loadOwned(id, orgId));
    },

    async listForSession(sessionId: string, orgId: string): Promise<ChangeSet[]> {
      await deps.precon.assertSessionOrg(sessionId, orgId);
      return (await repo.listForSession(sessionId)).map(toChangeSet);
    },

    // Every grant is checked before the first write, so a set that touches
    // verify fails whole for a role without verify instead of half-applying.
    requiredPermissions(set: Pick<ChangeSet, "changes">): [string, string][] {
      const seen = new Set<string>();
      const out: [string, string][] = [];
      for (const change of set.changes) {
        const [resource, action] = permissionFor(change);
        const key = `${resource}:${action}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([resource, action]);
        }
      }
      return out;
    },

    async apply(id: string, actor: string, orgId: string, can: CanFn): Promise<ChangeSet> {
      const set = await loadOwned(id, orgId);
      if (set.status !== "proposed") throw new ConflictError(`This change set is already ${set.status}`);
      for (const [resource, action] of this.requiredPermissions({ changes: set.changes })) {
        if (!can(resource, action)) throw new ForbiddenError(`Your role does not allow you to ${action} ${resource}`);
      }
      const live = await loadLive(set.surface, set.session_id!);
      const results: AppliedChange[] = [];
      for (let i = 0; i < set.changes.length; i++) {
        results.push(await applyChange(i, set.changes[i]!, live, deps.precon, actor));
      }
      const result: AppliedResult = {
        applied: results.filter((r) => r.outcome === "applied").length,
        skipped: results.filter((r) => r.outcome === "skipped").length,
        changes: results,
      };
      // rows that still exist and were written by the prompt: edits and creates, not deletes
      const touched = set.changes
        .map((c, i) => (results[i]?.outcome === "applied" && c.op !== "delete" ? (c.id ?? results[i]?.undo?.id) : undefined))
        .filter((v): v is string => typeof v === "string");
      const entity = set.surface === "bill" ? "boq_row" : "programme_task";
      await repo.stampOrigin(entity, touched, "prompt");
      await repo.setStatus(set.id, "applied", result);
      await audit(set, actor, "assist.applied", { applied: result.applied, skipped: result.skipped });
      return toChangeSet({ ...set, status: "applied", applied_result: result, applied_at: new Date() });
    },

    async undo(id: string, actor: string, orgId: string, can: CanFn): Promise<ChangeSet> {
      const set = await loadOwned(id, orgId);
      if (set.status !== "applied" || !set.applied_result) throw new ConflictError("Only an applied change set can be undone");
      for (const [resource, action] of this.requiredPermissions({ changes: set.changes })) {
        if (!can(resource, action)) throw new ForbiddenError(`Your role does not allow you to ${action} ${resource}`);
      }
      const live = await loadLive(set.surface, set.session_id!);
      const entity = set.surface === "bill" ? "boq_row" : "programme_task";
      let restored = 0;
      // reverse order so a delete-then-create pair unwinds cleanly
      for (const applied of [...set.applied_result.changes].reverse()) {
        if (applied.outcome !== "applied" || !applied.undo) continue;
        if ((await undoChange(applied.undo, entity, live, deps.precon, actor)) === "applied") restored++;
      }
      await repo.setStatus(set.id, "undone", { ...set.applied_result, applied: restored });
      await audit(set, actor, "assist.undone", { restored });
      return toChangeSet({ ...set, status: "undone" });
    },

    async discard(id: string, actor: string, orgId: string): Promise<ChangeSet> {
      const set = await loadOwned(id, orgId);
      if (set.status !== "proposed") throw new ConflictError(`This change set is already ${set.status}`);
      await repo.setStatus(set.id, "discarded", null);
      await audit(set, actor, "assist.discarded", {});
      return toChangeSet({ ...set, status: "discarded" });
    },
  };
}

export type PreconAssistService = ReturnType<typeof preconAssistService>;
