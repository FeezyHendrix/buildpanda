// What the take-off scope's validator must and must not change.
//
// `vertices: [[null, 5]]` once validated, because Ajv coerces `null` to `0` for
// a `number`: the writer was handed a point at the origin the caller never sent
// and measured a shape nobody drew. `plugins/request-validation.ts` refuses it
// by compiling bodies with coercion off — but that refusal is only correct
// where a coordinate is being written. Installed on the root instance it also
// refused `{"amount": "500"}` on the finance routes, which had always been
// taken, so it is installed per take-off plugin instead.
//
// This suite pins both halves against real Fastify and the real compiler:
// inside the scope a coordinate must be typed, and outside it nothing moves.
// The parent instance below is configured exactly as `server.ts` configures the
// app — same `ajv.plugins`, no `setValidatorCompiler` — so the encapsulation
// being asserted is the one the server relies on. The shipped routes are probed
// end to end in `recovery-validation-scope-env/probe-routes.mts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyError } from "fastify";
import type { Ajv } from "@fastify/ajv-compiler";
import { isSupportedCurrency } from "../../../lib/currencies.ts";
import { validatorFor } from "../../../plugins/request-validation.ts";

const vertices = {
  type: "array",
  minItems: 1,
  maxItems: 2000,
  items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
} as const;

const geometryBody = {
  type: "object",
  required: ["vertices"],
  additionalProperties: false,
  properties: { vertices },
} as const;

const amountBody = {
  type: "object",
  required: ["amount"],
  additionalProperties: false,
  properties: { amount: { type: "number", exclusiveMinimum: 0 } },
} as const;

const currencyBody = {
  type: "object",
  required: ["currency"],
  additionalProperties: false,
  properties: { currency: { type: "string", format: "currency" } },
} as const;

const textQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1 },
    tags: { type: "array", items: { type: "string" } },
  },
} as const;

interface Echo {
  readonly vertices?: readonly (readonly number[])[];
  readonly amount?: number;
  readonly currency?: string;
  readonly page?: number;
  readonly tags?: readonly string[];
}

/** Exactly the factory call `server.ts` makes: same `ajv.plugins`, no compiler. */
const newFactoryApp = () =>
  Fastify({
    logger: false,
    ajv: {
      plugins: [
        (ajv: Ajv): Ajv => {
          ajv.addFormat("currency", { type: "string", validate: isSupportedCurrency });
          return ajv;
        },
      ],
    },
  });

// `Fastify()` returns the instance intersected with a thenable, and `await`
// strips that intersection — so the tests hold the awaited shape, not the raw one.
type ProbeApp = Awaited<ReturnType<typeof newFactoryApp>>;

/**
 * That app, plus two sibling route plugins: `/scoped/*` is a take-off module
 * (it installs `validatorFor` on itself) and `/plain/*` is any other module (it
 * does not). Both are registered on the same parent, so a difference between
 * them can only come from the encapsulated install.
 */
async function buildProbeApp(): Promise<ProbeApp> {
  const app = newFactoryApp();

  // Ajv's own rejection, not the API's rendering of it: `error-handler.ts` owns
  // the wire shape and is not what this suite is about.
  app.setErrorHandler(async (error: FastifyError, _request, reply) =>
    reply.code(error.statusCode ?? 500).send({ validation: error.validation ?? null }),
  );

  await app.register(async (scoped) => {
    scoped.setValidatorCompiler(validatorFor);
    scoped.post("/scoped/geometry", { schema: { body: geometryBody } }, async (req) => req.body as Echo);
    scoped.post("/scoped/amount", { schema: { body: amountBody } }, async (req) => req.body as Echo);
    scoped.post("/scoped/currency", { schema: { body: currencyBody } }, async (req) => req.body as Echo);
    scoped.get("/scoped/query", { schema: { querystring: textQuery } }, async (req) => req.query as Echo);
  });

  await app.register(async (plain) => {
    plain.post("/plain/amount", { schema: { body: amountBody } }, async (req) => req.body as Echo);
    plain.post("/plain/currency", { schema: { body: currencyBody } }, async (req) => req.body as Echo);
    plain.get("/plain/query", { schema: { querystring: textQuery } }, async (req) => req.query as Echo);
  });

  await app.ready();
  return app;
}

/** `payload` is a raw string so a test can send JSON TypeScript cannot express. */
async function post(app: ProbeApp, url: string, payload: string) {
  return app.inject({ method: "POST", url, payload, headers: { "content-type": "application/json" } });
}

test("a take-off body refuses a null where the schema says number", async () => {
  const app = await buildProbeApp();
  const res = await post(app, "/scoped/geometry", '{"vertices":[[null,5],[1,2],[3,4]]}');

  assert.equal(res.statusCode, 400);
  const { validation } = res.json() as { validation: { instancePath: string; params: unknown }[] | null };
  assert.equal(validation?.[0]?.instancePath, "/vertices/0/0");
  assert.deepEqual(validation?.[0]?.params, { type: "number" });
  await app.close();
});

test("a take-off body refuses a coordinate sent as a string", async () => {
  const app = await buildProbeApp();
  const res = await post(app, "/scoped/geometry", '{"vertices":[["12",5],[1,2],[3,4]]}');

  assert.equal(res.statusCode, 400);
  await app.close();
});

test("a take-off body refuses a non-finite coordinate", async () => {
  const app = await buildProbeApp();
  const res = await post(app, "/scoped/geometry", '{"vertices":[[1e999,5],[1,2],[3,4]]}');

  assert.equal(res.statusCode, 400);
  await app.close();
});

test("a take-off body takes typed coordinates through unaltered", async () => {
  const app = await buildProbeApp();
  const res = await post(app, "/scoped/geometry", '{"vertices":[[1.5,-2],[0,0],[3,4.25]]}');

  assert.equal(res.statusCode, 200);
  assert.deepEqual((res.json() as Echo).vertices, [[1.5, -2], [0, 0], [3, 4.25]]);
  await app.close();
});

test("a take-off body refuses a bare null the same way a nested one is refused", async () => {
  const app = await buildProbeApp();
  const res = await post(app, "/scoped/amount", '{"amount":null}');

  assert.equal(res.statusCode, 400);
  await app.close();
});

test("a sibling route plugin keeps the coercion the factory gave it", async () => {
  const app = await buildProbeApp();

  const sibling = await post(app, "/plain/amount", '{"amount":"500"}');
  const scoped = await post(app, "/scoped/amount", '{"amount":"500"}');

  assert.equal(sibling.statusCode, 200, "an unrelated route must still take a string number");
  assert.equal((sibling.json() as Echo).amount, 500);
  assert.equal(scoped.statusCode, 400, "the take-off scope must refuse what it did not type");
  await app.close();
});

test("query strings keep Fastify's baseline coercion inside the take-off scope", async () => {
  const app = await buildProbeApp();

  // Fastify's baseline is `coerceTypes: 'array'`, not `true`: a single query
  // value against an array schema is wrapped rather than rejected. Restating
  // the baseline by hand is what once dropped this.
  const scoped = await app.inject({ method: "GET", url: "/scoped/query?page=2&tags=roof" });
  const sibling = await app.inject({ method: "GET", url: "/plain/query?page=2&tags=roof" });

  assert.equal(scoped.statusCode, 200);
  assert.deepEqual(scoped.json(), sibling.json());
  assert.deepEqual((scoped.json() as Echo).tags, ["roof"]);
  assert.equal((scoped.json() as Echo).page, 2);
  await app.close();
});

test("the currency format resolves in both scopes", async () => {
  const app = await buildProbeApp();

  const scopedOk = await post(app, "/scoped/currency", '{"currency":"NGN"}');
  const scopedBad = await post(app, "/scoped/currency", '{"currency":"XXX"}');
  const siblingOk = await post(app, "/plain/currency", '{"currency":"NGN"}');
  const siblingBad = await post(app, "/plain/currency", '{"currency":"XXX"}');

  assert.equal(scopedOk.statusCode, 200);
  assert.equal(siblingOk.statusCode, 200);
  assert.equal(scopedBad.statusCode, 400);
  assert.equal(siblingBad.statusCode, 400);
  await app.close();
});
