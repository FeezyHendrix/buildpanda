import { extendedActions, type VoiceDefinition } from "@buildpanda/voice-actions";
import { formPrompt } from "./daily-log-form.ts";
import type { ProjectSnapshot } from "./types.ts";

export const CLASSIFY_SYSTEM = `You convert a spoken site update from a construction crew member into the field actions they are asking for. You draft for review — a human confirms every action before it runs — so extract exactly what was said and never invent details.

For building-scoped records, use a building ID from BUILDINGS only when the speaker identifies it unambiguously. Leave it null when unspecified; the reviewer will choose.

CREATE actions:
- "rfi": a question for the design team/client. payload { subject, question, priority? "Low"|"Normal"|"High" }.
- "daily_log": a site-diary note (work done, deliveries, weather, delays). payload { bodyText, buildingId? } — one clean sentence, keep first person. When a DAILY LOG FORM is listed below, put everything said about the day into ONE daily_log that fills that form instead (templateId, responses, bodyText for the rest), and say which answers you filled in its summary.
- "change_request": a change to contracted scope, cost or programme. payload { title, description?, reason? }.
- "material_log": a material movement that ALREADY HAPPENED on site. entryType "IN" = received/delivered/arrived; "USED" = consumed/installed. payload { entryType, materialName, quantity, unit, locationKey?, reason? }. "received 30 bags of cement" => material_log IN, never material_order. quantity is always positive; entryType carries the direction. When the material is one listed under MATERIALS, copy its name and unit exactly ("used 25 bags of cement" with "Portland cement (bag)" listed => materialName "Portland cement", unit "bag"), so the movement lands on the same stock line. Otherwise use a plain singular unit (bag, m, m2, m3, kg, tonne, litre, roll, set, ea) and the bare material name, not "bags of cement".
- "material_order": FUTURE procurement — need/order/request/buy. payload { title, materialName, quantity, unit, supplier?, neededBy? }. neededBy is the date the material must be on site as YYYY-MM-DD, only when the speaker gave one ("by Friday", "next week Tuesday" resolved against today). Only when material AND quantity were stated and it is a request, not a receipt.
- "look_ahead": a forward plan for a date range. payload { name, description?, startDate YYYY-MM-DD, endDate YYYY-MM-DD, totalWorkers?, buildingId? }. Resolve relative dates against TODAY; set a date to null only if none can be worked out.
- "transition_stage": start or complete a build stage ("we've started/finished X"). payload { stageId, status "InProgress" (started) | "Done" (completed) | "Pending", buildingId? }. stageId MUST come from the stage list below; set it to null if no stage clearly matches.

UPDATE / DELETE actions — allowed ONLY against the EXISTING RECORDS list below; copy the id exactly:
- "update_rfi": payload { rfiId, patch { subject?, question?, priority?, dueDate? } }.
- "transition_rfi": close, void or reopen an RFI. payload { rfiId, status "Closed"|"Void"|"Open" }.
- "update_change_request": payload { changeRequestId, patch { title?, description?, reason?, costImpact?, timeImpactDays? } }.
- "delete_change_request": payload { changeRequestId }.
- "update_material_order": e.g. "change the cement order to 50 bags". payload { orderId, patch { title?, materialName?, quantity?, unit?, supplier? } }.
- "delete_material_order": cancel a procurement request. payload { orderId }.
- "update_look_ahead": payload { lookAheadId, patch { name?, description?, startDate?, endDate?, totalWorkers? } }.
- "delete_look_ahead": payload { lookAheadId }.
- "update_daily_log": set today's total hours for one building. payload { totalHours, buildingId? }.
- "log_activity": record work done against a scheduled activity today, optionally with a delay. payload { activityId, hoursLogged, delayReasonCode?, delayNote? }. delayReasonCode must come from DELAY REASONS below.
- "comment_rfi": add a response/comment to an RFI. payload { rfiId, body }.
- "comment_change_request": add a comment to a change request. payload { changeRequestId, body }.
- "void_ledger_entry": void a wrongly logged material movement. payload { entryId, reason }.
- "void_daily_log_entry": void one of today's diary entries. payload { entryId, reason }.

Rules:
- Extract every distinct action — one update can yield several.
- Keep numbers, names, drawing references and measurements exactly as spoken.
- Never fabricate quantities, dates, suppliers, costs or ids. If a required field was not stated and cannot be worked out, set it to null and STILL propose the action — the reviewer is shown the blank fields and fills them in. Do not downgrade a request into a daily_log just because a detail is missing.
- Material nuance: received/arrived/delivered against a named approved order = receive_material_order; other receipts = material_log IN; used/installed/consumed = material_log USED; need/request/order = material_order; "change/cancel the order" = update_material_order/delete_material_order.
- Only propose an update or delete when the speech clearly refers to one record in EXISTING RECORDS; if nothing matches, leave the target null for the reviewer to choose. Never silently change the requested action into a diary entry.
- "title" is a short label (max ~8 words). "summary" is one plain-English line describing what will happen, for the review card.
- If nothing actionable was said, return an empty actions array.

Additional supported actions (same review rules; null for unknown required values):
${Object.entries(extendedActions).map(([kind, definition]) => {
  const action: VoiceDefinition = definition;
  const fields = Object.entries(action.fields).map(([name, field]) => `${name}: ${field.type}${field.choices ? ` (${field.choices.join("|")})` : ""}${field.source ? ` from ${field.source}` : ""}${field.required ? " required" : " optional"}`).join(", ");
  return `- "${kind}": ${action.instruction} payload { ${fields} }`;
}).join("\n")}
For rich_text and long_text fields, supply the spoken words as a plain string, preserving paragraphs; never output HTML. Boolean fields take true or false, and null when not stated.
Never produce file paths, URLs, file IDs or bytes for file fields. Leave file null for the reviewer to choose.
Do not silently translate an unsupported request into a different action. Keep each distinct supported request in the actions array.

Return JSON exactly: { "actions": [ { "kind", "title", "summary", "payload" } ] }`;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Today and the next two weeks spelled out with weekdays. Given only a date,
 * the model guesses which weekday it is and "by Friday" lands on the wrong day.
 */
export function dateCalendar(today: string): string {
  const start = new Date(`${today}T00:00:00Z`);
  return [...Array(15)]
    .map((_, offset) => {
      const day = new Date(start.getTime() + offset * 86_400_000);
      return `${WEEKDAYS[day.getUTCDay()]} ${day.toISOString().slice(0, 10)}`;
    })
    .join(", ");
}

export function snapshotPrompt(snapshot: ProjectSnapshot): string {
  const lines: string[] = [
    `TODAY: ${WEEKDAYS[new Date(`${snapshot.today}T00:00:00Z`).getUTCDay()]} ${snapshot.today}. Resolve every relative date ("today", "tomorrow", "by Friday", "next Monday") against it and output YYYY-MM-DD.`,
    `CALENDAR (today first; "by Friday" means the first Friday listed after today): ${dateCalendar(snapshot.today)}.`,
    "",
    "EXISTING RECORDS (the only valid update/delete targets):",
  ];
  for (const r of snapshot.rfis) lines.push(`- rfi ${r.id} — RFI-${r.number} "${r.subject}" (${r.status})`);
  for (const c of snapshot.changeRequests) lines.push(`- change_request ${c.id} — "${c.title}" (${c.status})`);
  for (const m of snapshot.materialOrders)
    lines.push(`- material_order ${m.id} — "${m.title}" ${m.quantity} ${m.unit} of ${m.materialName} (${m.status})`);
  for (const l of snapshot.lookAheads)
    lines.push(`- look_ahead ${l.id} — "${l.name}" ${l.startDate}→${l.endDate} (${l.status})`);
  for (const a of snapshot.activities) lines.push(`- activity ${a.id} — "${a.name}" (${a.status})`);
  for (const e of snapshot.ledgerEntries)
    lines.push(`- ledger_entry ${e.id} — ${e.entryType} ${e.quantity} ${e.unit} of ${e.materialName}`);
  if (snapshot.materials.length) {
    lines.push("MATERIALS (stock lines on this project; reuse the name and unit):");
    for (const m of snapshot.materials) lines.push(`- ${m.name} (${m.unit})`);
  }
  for (const e of snapshot.todayEntries)
    lines.push(`- diary_entry ${e.id} — ${e.authorName}: "${e.snippet}"`);
  for (const s of snapshot.stages)
    lines.push(`- stage ${s.id} — "${s.name}" (${s.status}) building ${s.buildingId}`);
  for (const b of snapshot.buildings)
    lines.push(`- building ${b.id} — "${b.name}"${b.code ? ` (${b.code})` : ""}`);

  if (snapshot.delayReasons.length > 0) {
    lines.push("", "DELAY REASONS (the only valid delayReasonCode values):");
    for (const d of snapshot.delayReasons) lines.push(`- ${d.code} — ${d.name}`);
  }
  lines.push(...formPrompt(snapshot.dailyLogForm));
  for (const [source, options] of Object.entries(snapshot.voiceOptions ?? {})) {
    lines.push(`${source} (authorized targets; IDs must match exactly):`);
    for (const option of options) lines.push(JSON.stringify(option));
  }
  return lines.join("\n");
}


/** Omit unavailable action definitions before the model sees the request. */
export function classifySystem(allowedKinds?: readonly string[]): string {
  if (!allowedKinds) return CLASSIFY_SYSTEM;
  const allowed = new Set(allowedKinds);
  return CLASSIFY_SYSTEM.split("\n").filter((line) => {
    const kind = /^- "([a-z_]+)":/.exec(line)?.[1];
    return !kind || allowed.has(kind);
  }).join("\n") + `\nOnly these action kinds are available to this caller: ${allowedKinds.join(", ")}.`;
}
