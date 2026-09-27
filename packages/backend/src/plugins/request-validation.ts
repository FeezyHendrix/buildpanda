// Coerce what arrives as text. Never coerce what arrives already typed.
//
// Fastify compiles every schema — params, querystring, headers AND body — with
// one Ajv whose default is `coerceTypes: 'array'`. That is right for the first
// three: a path segment and a query value are strings on the wire, so `?page=2`
// has to become the number 2 or no route could type its own input.
//
// It is wrong for a JSON body, where the client already sent a typed value, and
// it is actively unsafe for one reason: **Ajv coerces `null` to `0` for a
// `number`**. So `vertices: [[null, 5]]` validated, and the writer was handed a
// point at the origin that the caller never sent — a coordinate silently
// invented by the validator, which then measured a shape nobody drew. Bounds
// cannot catch it, because 0 is a perfectly legal coordinate; nor can the
// writer, because by the time it runs the null is gone.
//
// So bodies are compiled by a second Ajv with coercion off. The only requests
// this newly refuses are ones that were relying on the validator to invent a
// value for them — and two things keep that from spreading past the drawing.
//
// 1. **Scope.** This is NOT installed on the root instance. Refusing an
//    uncoerced body is right where a coordinate is being written and wrong
//    everywhere else: `{"amount": "500"}` is a body the finance routes have
//    always taken. So each take-off module installs it on its own encapsulated
//    plugin — `fastify.setValidatorCompiler(validatorFor)` in
//    `pdf-takeoff/routes.ts` and `drawing-markup/routes.ts` — and Fastify's
//    SchemaController is per-context, so a sibling route plugin keeps the
//    factory's compiler untouched.
// 2. **Parity.** Neither instance restates Fastify's defaults. `{}` means
//    literally "whatever Fastify's baseline is", because @fastify/ajv-compiler
//    merges `customOptions` over that baseline. Copying the values out by hand
//    is how the text instance came to differ in a SECOND option — a stated
//    `coerceTypes: true` drops the scalar↔array coercion a query string
//    relies on — so the list is not copied at all and the two instances differ
//    in exactly the one option below.
//
// The `currency` format is re-added because a validator built this way does not
// inherit the factory's `ajv.plugins`. That factory registration stays where it
// is and still serves every other route; this is what lets the take-off scope
// compile the same schemas instead of crashing at boot on an unknown format.
// ajv-formats is still added by the compiler itself — it only stands aside for
// a plugin literally named `formatsPlugin` — so the formats, the defaults and
// the error shape are the ones the rest of the API already answers with.
//
// (Non-finite numbers were already refused — Ajv's `number` check rejects
// Infinity in both modes — so this is only about `null`.)

import AjvCompiler from "@fastify/ajv-compiler";
import type { Ajv } from "@fastify/ajv-compiler";
import type { FastifySchema, FastifySchemaCompiler } from "fastify";
import { isSupportedCurrency } from "../lib/currencies.ts";

const currency = (ajv: Ajv): Ajv => {
  ajv.addFormat("currency", { type: "string", validate: isSupportedCurrency });
  return ajv;
};

const build = AjvCompiler();
const forText = build({}, { customOptions: {}, plugins: [currency] });
const forJson = build({}, { customOptions: { coerceTypes: false }, plugins: [currency] });

export const validatorFor: FastifySchemaCompiler<FastifySchema> = (request) =>
  (request.httpPart === "body" ? forJson : forText)(request as never) as ReturnType<
    FastifySchemaCompiler<FastifySchema>
  >;
