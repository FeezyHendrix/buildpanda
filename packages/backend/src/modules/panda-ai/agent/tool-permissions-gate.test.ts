// The toolbox a caller actually gets, driven through the real `toolsForCaller`.
//
// This suite covers the permission gate that arrived on master while the
// take-off workbook was being built, at exactly the seam where the two meet:
// `get_precon_boq` now carries the workbook payload, and it is reached with
// `takeoffs:view` or not at all.
//
// No LLM is involved and none can be. The assistant's toolbox is chosen before
// a single token is generated, so the decision under test is a pure function of
// the caller's grants — asserting it here is asserting exactly what the model
// would have been offered, with no network, no key and no prompt in the loop.
// Nothing in here asserts prompt prose: wording changes, the gate must not.
//
// Four properties:
//
//   1. WITHHELD. A participant without `takeoffs:view` is not offered the tool.
//      The denied caller holds a DIFFERENT grant they do get a tool for, so a
//      pass means the filter selected, not that it returned nothing.
//   2. OFFERED. The same participant plus `takeoffs:view` is offered it.
//   3. REFUSED WHEN REACHED. Withholding is the belt; the wrapper is the
//      braces. A tool handed a context that may not read it throws rather than
//      returning the take-off.
//   4. FAIL CLOSED. Every shipped tool has a policy, and a tool with no policy
//      is dropped — so a future tool cannot reach the model ungated.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Knex } from "knex";
import { ForbiddenError } from "../../../lib/errors.ts";
import { buildTools, type AgentCaller, type ToolContext } from "./tools.ts";
import { TOOL_PERMISSIONS, permissionFor, toolsForCaller } from "./tool-permissions.ts";
import { tool, fn, type AgentTool } from "./tool-helpers.ts";

const PROJECT_ID = "prj_gate";
const ORG_ID = "org_gate";
const TAKEOFF_TOOL = "get_precon_boq";

/**
 * Gating must decide from the caller's grants alone. Any property read on this
 * stub is a query the gate had no business making, so it fails the test instead
 * of silently connecting.
 */
const noDatabase = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(`the permission gate touched the database: ${String(property)}`);
    },
    apply() {
      throw new Error("the permission gate queried the database");
    },
  },
) as unknown as Knex;

/**
 * A real project participant, shaped as `auth-context` builds one: a participant
 * role that gets them through the tenant gate, and explicit `projectGrants`,
 * which `effectiveParticipantGrants` treats as authoritative. They are a
 * stranger to the project's owner and hold no org role, so every allow below
 * comes from the grant under test and from nothing else.
 */
function participant(grants: Record<string, readonly string[]>): AgentCaller {
  return {
    user: { id: "usr_gate", name: "QS" },
    project: { id: PROJECT_ID, ownerId: "usr_someone_else", organizationId: ORG_ID },
    orgRoles: new Map(),
    projectRoles: new Map([[PROJECT_ID, "client"]]),
    orgPermissions: new Map(),
    projectSectionPermissions: new Map(),
    projectGrants: new Map([[PROJECT_ID, grants]]),
  };
}

function contextFor(caller: AgentCaller): ToolContext {
  return { db: noDatabase, projectId: PROJECT_ID, caller };
}

const toolNames = (ctx: ToolContext): string[] =>
  toolsForCaller(buildTools(), ctx).map((entry) => entry.spec.function.name);

/** Holds tasks but NOT take-offs — so a withheld take-off tool is a choice. */
const WITHOUT_TAKEOFFS = participant({ tasks: ["view"] });
const WITH_TAKEOFFS = participant({ tasks: ["view"], takeoffs: ["view"] });

describe("the take-off tool is gated by takeoffs:view", () => {
  test("Given a participant without takeoffs:view, When the toolbox is built, Then the take-off tool is absent", () => {
    const offered = toolNames(contextFor(WITHOUT_TAKEOFFS));

    assert.ok(
      !offered.includes(TAKEOFF_TOOL),
      `${TAKEOFF_TOOL} was offered to a caller who may not view take-offs`,
    );
    // The same caller's other grant still produces a tool, so the assertion
    // above is about the take-off gate and not about an empty toolbox.
    assert.ok(offered.includes("get_tasks"), "the filter withheld a tool the caller may read");
  });

  test("Given a participant with takeoffs:view, When the toolbox is built, Then the take-off tool is offered", () => {
    assert.ok(toolNames(contextFor(WITH_TAKEOFFS)).includes(TAKEOFF_TOOL));
  });

  test("Given the granted take-off tool, When it is run for a caller without the grant, Then it refuses", async () => {
    const granted = toolsForCaller(buildTools(), contextFor(WITH_TAKEOFFS)).find(
      (entry) => entry.spec.function.name === TAKEOFF_TOOL,
    );
    assert.ok(granted, "fixture: the take-off tool should be granted here");

    await assert.rejects(
      () => granted.run(contextFor(WITHOUT_TAKEOFFS), {}),
      (error: unknown) => error instanceof ForbiddenError,
      "a tool reached with an unentitled context must refuse, not read",
    );
  });

  test("Given the take-off tool's spec, When its parameters are read, Then there is no id a caller could widen the scope with", () => {
    const spec = buildTools().find((entry) => entry.spec.function.name === TAKEOFF_TOOL)?.spec;
    assert.ok(spec, "fixture: the take-off tool should exist");

    // The project is injected by the service from the request's own scope. The
    // model is given nothing to name, so it cannot ask for another project's
    // take-off or another session's workbook.
    assert.deepEqual(spec.function.parameters.properties, {});
    assert.deepEqual(spec.function.parameters.required, []);
  });

  test("Given the take-off tool's policy, When it is read, Then it is the same resource/action its route enforces", () => {
    assert.deepEqual(permissionFor(TAKEOFF_TOOL), { resource: "takeoffs", action: "view" });
  });
});

describe("no tool reaches the model ungated", () => {
  test("Given every shipped tool, When its policy is looked up, Then each one has an entry", () => {
    const missing = buildTools()
      .map((entry) => entry.spec.function.name)
      .filter((name) => permissionFor(name) === undefined);

    assert.deepEqual(missing, [], "a shipped tool has no entry in TOOL_PERMISSIONS");
  });

  test("Given every policy, When it is matched to a tool, Then none is left over", () => {
    const shipped = new Set(buildTools().map((entry) => entry.spec.function.name));
    const orphans = Object.keys(TOOL_PERMISSIONS).filter((name) => !shipped.has(name));

    assert.deepEqual(orphans, [], "TOOL_PERMISSIONS names a tool that is not shipped");
  });

  test("Given a tool with no policy at all, When the toolbox is built, Then it is dropped", () => {
    const ungated: AgentTool = tool(fn("tool_with_no_policy", "never gated"), async () => ({
      output: { leaked: true },
    }));

    const offered = toolsForCaller([...buildTools(), ungated], contextFor(WITH_TAKEOFFS));

    assert.ok(
      !offered.some((entry) => entry.spec.function.name === "tool_with_no_policy"),
      "a tool with no policy was offered — the gate must fail closed",
    );
  });
});
