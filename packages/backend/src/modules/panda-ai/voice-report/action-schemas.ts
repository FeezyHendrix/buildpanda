import { z } from "zod";
// Missing words/amounts remain reviewable; field validation blocks application.
const requiredText = z.string().catch("");
const priority = z.enum(["Low", "Normal", "High"]);

const rfiPayload = z.object({
  subject: requiredText,
  question: requiredText,
  priority: priority.optional(),
});

const dailyLogPayload = z.object({
  bodyText: requiredText,
  buildingId: requiredText.nullish(),
  templateId: requiredText.nullish(),
  responses: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullish(),
});

const changeRequestPayload = z.object({
  title: requiredText,
  description: z.string().nullish(),
  reason: z.string().nullish(),
});

const materialOrderPayload = z.object({
  title: requiredText,
  materialName: requiredText,
  quantity: z.number().catch(0),
  unit: requiredText,
  supplier: z.string().nullish(),
  // The orders API requires this; when unsaid the reviewer is asked for it.
  neededBy: z.string().nullish(),
});

const materialLogPayload = z.object({
  entryType: z.enum(["IN", "USED"]).nullable().catch(null),
  materialName: requiredText,
  // "Used 25" is 25 out, never -25: the entry type carries the direction.
  quantity: z.number().transform(Math.abs).catch(0),
  unit: requiredText,
  locationKey: z.string().nullish(),
  reason: z.string().nullish(),
  notesHtml: z.string().nullish(),
});

// startDate/endDate/buildingId are nullable so an action the speaker described
// but under-specified still reaches the reviewer, who fills the gap in the app.
const lookAheadPayload = z.object({
  name: requiredText,
  description: z.string().nullish(),
  startDate: requiredText.nullish(),
  endDate: requiredText.nullish(),
  totalWorkers: z.number().nullish(),
  buildingId: requiredText.nullish(),
});

const stageTransitionPayload = z.object({
  stageId: requiredText.nullish().transform((id) => id ?? null),
  status: z.enum(["Pending", "InProgress", "Done"]).nullish().transform((status) => status ?? null),
  buildingId: requiredText.nullish(),
});

const rfiUpdatePayload = z.object({
  rfiId: requiredText,
  patch: z
    .object({
      subject: requiredText.optional(),
      question: requiredText.optional(),
      priority: priority.optional(),
      dueDate: z.string().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const rfiTransitionPayload = z.object({
  rfiId: requiredText,
  status: z.enum(["Closed", "Void", "Open"]).nullable().catch(null),
});

const changeRequestUpdatePayload = z.object({
  changeRequestId: requiredText,
  patch: z
    .object({
      title: requiredText.optional(),
      description: z.string().nullish(),
      reason: z.string().nullish(),
      costImpact: z.number().optional(),
      timeImpactDays: z.number().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const changeRequestDeletePayload = z.object({ changeRequestId: requiredText });

const materialOrderUpdatePayload = z.object({
  orderId: requiredText,
  patch: z
    .object({
      title: requiredText.optional(),
      materialName: requiredText.optional(),
      quantity: z.number().optional(),
      unit: requiredText.optional(),
      supplier: z.string().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const materialOrderDeletePayload = z.object({ orderId: requiredText });

const lookAheadUpdatePayload = z.object({
  lookAheadId: requiredText,
  patch: z
    .object({
      name: requiredText.optional(),
      description: z.string().nullish(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      totalWorkers: z.number().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const lookAheadDeletePayload = z.object({ lookAheadId: requiredText });

const dailyLogUpdatePayload = z.object({ totalHours: z.number().min(0).nullable().catch(null), buildingId: requiredText.nullish() });

const activityLogPayload = z.object({
  activityId: requiredText,
  hoursLogged: z.number().min(0).nullable().catch(null),
  delayReasonCode: z.string().nullish(),
  delayNote: z.string().nullish(),
});

const rfiCommentPayload = z.object({ rfiId: requiredText, body: requiredText });

const changeRequestCommentPayload = z.object({
  changeRequestId: requiredText,
  body: requiredText,
});

const ledgerVoidPayload = z.object({ entryId: requiredText, reason: requiredText });

const dailyLogEntryVoidPayload = z.object({ entryId: requiredText, reason: requiredText });

const base = { title: requiredText, summary: z.string() };

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rfi"), ...base, payload: rfiPayload }),
  z.object({ kind: z.literal("daily_log"), ...base, payload: dailyLogPayload }),
  z.object({ kind: z.literal("change_request"), ...base, payload: changeRequestPayload }),
  z.object({ kind: z.literal("material_log"), ...base, payload: materialLogPayload }),
  z.object({ kind: z.literal("material_order"), ...base, payload: materialOrderPayload }),
  z.object({ kind: z.literal("look_ahead"), ...base, payload: lookAheadPayload }),
  z.object({ kind: z.literal("update_rfi"), ...base, payload: rfiUpdatePayload }),
  z.object({ kind: z.literal("transition_rfi"), ...base, payload: rfiTransitionPayload }),
  z.object({ kind: z.literal("update_change_request"), ...base, payload: changeRequestUpdatePayload }),
  z.object({ kind: z.literal("delete_change_request"), ...base, payload: changeRequestDeletePayload }),
  z.object({ kind: z.literal("update_material_order"), ...base, payload: materialOrderUpdatePayload }),
  z.object({ kind: z.literal("delete_material_order"), ...base, payload: materialOrderDeletePayload }),
  z.object({ kind: z.literal("update_look_ahead"), ...base, payload: lookAheadUpdatePayload }),
  z.object({ kind: z.literal("delete_look_ahead"), ...base, payload: lookAheadDeletePayload }),
  z.object({ kind: z.literal("update_daily_log"), ...base, payload: dailyLogUpdatePayload }),
  z.object({ kind: z.literal("log_activity"), ...base, payload: activityLogPayload }),
  z.object({ kind: z.literal("comment_rfi"), ...base, payload: rfiCommentPayload }),
  z.object({ kind: z.literal("comment_change_request"), ...base, payload: changeRequestCommentPayload }),
  z.object({ kind: z.literal("void_ledger_entry"), ...base, payload: ledgerVoidPayload }),
  z.object({ kind: z.literal("void_daily_log_entry"), ...base, payload: dailyLogEntryVoidPayload }),
  z.object({ kind: z.literal("transition_stage"), ...base, payload: stageTransitionPayload }),
]);


export type ParsedAction = z.infer<typeof actionSchema>;
