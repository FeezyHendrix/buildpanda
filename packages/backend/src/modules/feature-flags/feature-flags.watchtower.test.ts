import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { FEATURE_FLAGS } from "./definitions.ts";

function routePrefixesFor(key: string): readonly string[] {
  return FEATURE_FLAGS.find((flag) => flag.key === key)?.routePrefixes ?? [];
}

function toRegex(prefix: string): RegExp {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withParams = escaped.replace(/:([A-Za-z0-9_]+)/g, "[^/]+");
  return new RegExp(`^${withParams}(?:/|$)`);
}

function samplePath(prefix: string): string {
  return prefix.replace(/:([A-Za-z0-9_]+)/g, "sample");
}

const ALLOWED_NESTED_ROUTE_OWNERS = new Set([
  "sales.proposals>ai.automatedTakeoff",
  "commercial.finances>commercial.paymentClaims",
  "commercial.finances>commercial.purchaseOrders",
]);

function nestedOwnerKey(first: string, second: string): string {
  return `${first}>${second}`;
}

describe("feature flag watchtower", () => {
  it("keeps rollout-sensitive routes behind their owning flags", () => {
    assert.ok(
      routePrefixesFor("ai.chatAgent").includes("/projects/:id/ai/agent"),
      "Panda AI chat API must stay behind ai.chatAgent",
    );
    assert.ok(
      routePrefixesFor("projects.schedule").includes("/projects/:id/look-aheads"),
      "Look-aheads API must stay behind projects.schedule",
    );
    assert.ok(
      routePrefixesFor("commercial.materialsEquipment").includes("/projects/:id/suppliers"),
      "Suppliers API must stay behind commercial.materialsEquipment",
    );
  });

  it("does not let two flags compete for the same backend route space", () => {
    const routeOwners = FEATURE_FLAGS.flatMap((flag) =>
      flag.routePrefixes.map((prefix) => ({
        key: flag.key,
        prefix,
        pattern: toRegex(prefix),
        sample: samplePath(prefix),
      })),
    );
    const conflicts: string[] = [];

    for (let index = 0; index < routeOwners.length; index += 1) {
      const route = routeOwners[index];
      if (!route) continue;
      for (const other of routeOwners.slice(index + 1)) {
        if (route.key === other.key) continue;
        if (
          ALLOWED_NESTED_ROUTE_OWNERS.has(nestedOwnerKey(route.key, other.key)) ||
          ALLOWED_NESTED_ROUTE_OWNERS.has(nestedOwnerKey(other.key, route.key))
        ) {
          continue;
        }
        if (route.pattern.test(other.sample) || other.pattern.test(route.sample)) {
          conflicts.push(`${route.prefix} (${route.key}) overlaps ${other.prefix} (${other.key})`);
        }
      }
    }

    assert.deepEqual(conflicts, []);
  });

  it("does not define exact duplicate backend route prefixes", () => {
    const ownersByPrefix = new Map<string, string[]>();
    for (const flag of FEATURE_FLAGS) {
      for (const prefix of flag.routePrefixes) {
        const owners = ownersByPrefix.get(prefix) ?? [];
        owners.push(flag.key);
        ownersByPrefix.set(prefix, owners);
      }
    }

    const duplicates = [...ownersByPrefix.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([prefix, owners]) => `${prefix}: ${owners.join(", ")}`);

    assert.deepEqual(duplicates, []);
  });

  it("treats BIM issue dashboard preview as frontend-only unless it gets dedicated API routes", () => {
    assert.deepEqual(routePrefixesFor("projects.bimDashboard"), []);
  });

  it("keeps the frontend feature-flag catalogue exactly in sync with backend definitions", () => {
    const frontendPath = fileURLToPath(
      new URL("../../../../frontend/src/lib/feature-flags.ts", import.meta.url),
    );
    const source = readFileSync(frontendPath, "utf8");
    const frontendKeys = new Set(
      [...source.matchAll(/"([a-z]+\.[a-zA-Z]+)"/g)].map((match) => match[1]),
    );
    const backendKeys = new Set<string>(FEATURE_FLAGS.map((flag) => flag.key));

    const missingFromFrontend = [...backendKeys].filter((key) => !frontendKeys.has(key));
    const staleInFrontend = [...frontendKeys].filter(
      (key): key is string => key !== undefined && !backendKeys.has(key),
    );

    assert.deepEqual(
      missingFromFrontend,
      [],
      `Backend defines flags the frontend catalogue (feature-flags.ts) is missing: ${missingFromFrontend.join(", ")}. Add them so FeatureFlagKey stays complete.`,
    );
    assert.deepEqual(
      staleInFrontend,
      [],
      `Frontend catalogue lists flags absent from backend definitions: ${staleInFrontend.join(", ")}. The backend is the source of truth — remove them.`,
    );
  });
});
