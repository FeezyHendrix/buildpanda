import { fieldToolDescriptor, fieldToolSchemas, isFieldToolKind } from "../field-actions/tools.ts";
import { canonicalToolFields } from "../field-actions/tool-fields.ts";
import type { FieldToolDescriptor } from "../field-actions/tool-types.ts";
import type { MessagingAccess } from "./management-types.ts";

/** Review controls expose only follow-up workflows the current caller may create. */
export function messagingActionDescriptors(access: MessagingAccess): FieldToolDescriptor[] {
  return Object.keys(fieldToolSchemas).filter(isFieldToolKind).filter((kind) => access.capabilities.actions?.[kind]).map((kind) => {
    const descriptor = fieldToolDescriptor(kind);
    if (kind === "send_message" && (!access.permissions.messages?.includes("view") || !access.permissions.messages?.includes("send"))) {
      const { projectGeneral: _general, ...properties } = fieldToolSchemas.send_message.properties;
      const { oneOf: _targets, ...base } = fieldToolSchemas.send_message;
      const schema = { ...base, required: [...base.required, "channelId"], properties };
      return { ...descriptor, description: "Send the stated message to an authorized existing conversation selected by its actual channelId. Never choose an unstated recipient.", schema, fields: canonicalToolFields(kind, schema, descriptor.fields.filter((field) => field.name !== "projectGeneral")) };
    }
    if (kind === "create_expense") {
      const canonical = fieldToolSchemas.create_expense;
      const schema = { ...canonical, properties: { ...canonical.properties, currency: { ...canonical.properties.currency, enum: [access.project.currency], const: access.project.currency } } };
      return { ...descriptor, schema, fields: canonicalToolFields(kind, schema, descriptor.fields) };
    }
    if (kind !== "annotate_drawing") return descriptor;
    const canonical = fieldToolSchemas.annotate_drawing;
    const branches = canonical.properties.followUp.oneOf.filter((branch) => access.capabilities.actions?.[branch.properties.kind.const]);
    const { followUp: _followUp, ...base } = canonical.properties;
    const schema = { ...canonical, properties: { ...base, ...(branches.length ? { followUp: { oneOf: branches } } : {}) } };
    return { ...descriptor, schema,
      fields: canonicalToolFields(kind, schema, descriptor.fields.filter((field) => !field.name.startsWith("followUp"))) };
  });
}
