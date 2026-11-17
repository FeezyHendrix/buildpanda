import AjvCompiler from "@fastify/ajv-compiler";
import Decimal from "decimal.js";
import { BadRequestError } from "../../lib/errors.ts";

const compile = AjvCompiler()({}, { customOptions: { strict: false, allErrors: true, removeAdditional: false, coerceTypes: false, useDefaults: true,
  keywords: [{ keyword: "x-decimalPlaces", type: "number", schemaType: "number", validate: (scale: number, value: number) => Number.isInteger(scale) && scale >= 0 && Number.isFinite(value) && new Decimal(value).decimalPlaces() <= scale }],
} });
const validators = new WeakMap<object, ReturnType<typeof compile>>();

/** Use the canonical route schema without dropping unrecognized user intent. */
export function validateFieldPayload<T>(schema: object, payload: unknown): T {
  let validate = validators.get(schema);
  if (!validate) { validate = compile({ schema }); validators.set(schema, validate); }
  if (!validate(payload)) {
    const issues = validate.errors?.slice(0, 5).map((error) => {
      if (error.keyword === "x-decimalPlaces") {
        const scale = error.schemaPath.split("/").slice(1).reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key.replaceAll("~1", "/").replaceAll("~0", "~")] : undefined, schema);
        return `${error.instancePath || "Quantity"} supports up to ${scale === 2 ? "two" : String(scale)} decimal places; keep the original unit.`;
      }
      return `${error.instancePath || "Request"} ${error.message}`;
    }).join("; ");
    throw new BadRequestError(`Check the action details: ${issues || "invalid fields"}.`);
  }
  return payload as T;
}
