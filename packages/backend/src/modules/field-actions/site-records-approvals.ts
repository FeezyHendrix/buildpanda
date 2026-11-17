import { authorizeMaterialApprovalDelete, authorizeMaterialApprovalUpdate } from "../approvals/material-access.ts";
import { createBody, updateBody, resubmitBody, commentBody } from "../approvals/material-schemas.ts";
import type { CreateMaterialApprovalInput, UpdateMaterialApprovalInput, ResubmitMaterialApprovalInput } from "../approvals/material-types.ts";
import { buildMaterialApprovalsService } from "../approvals/material-wiring.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { requireSiteRecordReferences } from "./site-records-access.ts";
import type { FieldToolHandler } from "./tool-types.ts";

export const materialApprovalHandler: FieldToolHandler = async (input, context) => {
  const { approvalId, ...body } = input.payload;
  const id = approvalId as string, projectId = input.projectId, actorId = context.user.id;
  const service = buildMaterialApprovalsService(context.db, context.queue);
  let recordId: string, data: Record<string, unknown> | undefined;
  switch (input.kind) {
    case "create_material_approval": {
      await context.request.requireProjectPermission(projectId, "materials", "request");
      await requireSiteRecordReferences(context, body);
      const record = await service.create(projectId, validateFieldPayload<CreateMaterialApprovalInput>(createBody, body), actorId);
      recordId = record.id; break;
    }
    case "update_material_approval": case "decide_material_approval": {
      const patch = validateFieldPayload<UpdateMaterialApprovalInput>(updateBody, body);
      await authorizeMaterialApprovalUpdate(context.request, service, projectId, id, patch);
      await requireSiteRecordReferences(context, body);
      recordId = (await service.update(projectId, id, patch, actorId)).id; break;
    }
    case "reopen_material_approval": {
      await context.request.requireProjectPermission(projectId, "materials", "request");
      await requireSiteRecordReferences(context, body);
      const changes = validateFieldPayload<ResubmitMaterialApprovalInput>(resubmitBody, body);
      if ((await service.get(projectId, id)).status === "Resubmit") {
        const patch: UpdateMaterialApprovalInput = { ...changes, status: "Pending" };
        await authorizeMaterialApprovalUpdate(context.request, service, projectId, id, patch);
        recordId = (await service.update(projectId, id, patch, actorId)).id;
      } else {
        const record = await service.resubmit(projectId, id, changes, actorId);
        recordId = record.id; data = { resubmittedFromId: id };
      }
      break;
    }
    case "delete_material_approval": {
      await authorizeMaterialApprovalDelete(context.request, service, projectId, id);
      await service.remove(projectId, id); recordId = id; break;
    }
    default: {
      await context.request.requireProjectPermission(projectId, "comments", "post");
      await requireSiteRecordReferences(context, body);
      const comment = validateFieldPayload<{ body: string }>(commentBody, body);
      recordId = (await service.addComment(projectId, id, comment.body, { id: actorId, name: context.user.name })).id;
    }
  }
  return { kind: input.kind, projectId, recordId, ...(data ? { data, message: "Created a new material approval request linked to the previous request." } : {}) };
};
