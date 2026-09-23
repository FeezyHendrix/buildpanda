import { defineConfig } from "tsup";

// The build moved from a CLI one-liner to a config file for exactly one reason:
// the workbook calculation worker has to SHIP.
//
// `worker-client.ts` reaches the worker by URL, not by import, so a bundler has
// no edge to follow and would have emitted an API that resolves a file which
// does not exist in `dist/`. That failure only appears in a deployed process,
// under load, in a thread — the worst place to discover it. Naming the worker
// as its own entry is the fix, and it is a real entry point rather than a
// bundler trick: no eval, no generated code, no reading TypeScript at runtime.
//
// Two rules keep it working, and both are checked by
// `workbook-build.test.ts` and by the standalone dist driver:
//
//  1. The entry KEY must stay `worker-entry`, matching the source basename.
//     `worker-client.ts` resolves its sibling by swapping `.ts` for `.js`, so
//     the built name has to be the same stem.
//  2. Output stays flat in `dist/`. `worker-client.ts` is inlined into whatever
//     bundle imports it, so the worker must be that bundle's sibling.
//
// `cluster` and `server` keep their existing output paths — `npm start` runs
// `node dist/cluster.js` — and `workbook-engine` exposes the built calculation
// module so the artifact can be driven without the TypeScript sources present.
export default defineConfig({
  entry: {
    cluster: "src/cluster.ts",
    server: "src/server.ts",
    "worker-entry": "src/modules/panda-ai/pdf-takeoff/workbook/worker-entry.ts",
    "workbook-engine": "src/modules/panda-ai/pdf-takeoff/workbook/index.ts",
  },
  format: ["esm"],
  // Unchanged from the previous `--dts`: declarations for the two server
  // entries. The worker is an entry point, not a module anyone imports.
  dts: { entry: { cluster: "src/cluster.ts", server: "src/server.ts" } },
});
