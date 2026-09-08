# Take-off benchmark

Generated drawings with known answers, run through both take-off engines and
scored against the truth. Baseline recording only: nothing here gates a build.

```
pnpm --filter @buildpanda/backend benchmark              # run on committed fixtures
pnpm --filter @buildpanda/backend benchmark -- --regenerate
```

Output: `benchmark/results.json` (every scored line, raw engine output) and
`benchmark/results.md` (accuracy per family, convention, element, fixture).

## What is committed

- `fixtures/<family>__<convention>/drawing.dxf` — human-readable drawing
- `fixtures/<family>__<convention>/truth.json` — the manifest the engines are scored against
- `results.json`, `results.md` — the last recorded baseline

The DWG, PDF and the LibreDWG JSON the DWG is built from are generated at run
time (see `.gitignore`); the DWG needs `dwgwrite` from LibreDWG on the PATH
(`brew install libredwg`). Without it the harness scores the PDF engine only
and reports the DWG side as not run.

## Why the DWG goes through LibreDWG JSON

LibreDWG 0.13's DXF import drops layer, block and dimension references (every
entity lands on layer `?`). Its JSON import keeps them, so the generator writes
`drawing.libredwg.json` from `src/modules/panda-ai/benchmark/skeleton.json`
(an empty AC1015 file) and converts that with `dwgwrite -y -I JSON`.

## Families and conventions

Families: bungalow (3-bed), duplex (two plans), block4 (four storeys mirroring
the Ogudu layout: 24 m square, 28 columns, 22 doors and 163 m² per flat on each
floor) and tower20 (ground plus a typical floor repeated 19 times).

Conventions vary the layer naming (well named, office prefixes, everything on
layer 0), how doors and windows are drawn (blocks vs arcs and outlines), how
dimensions appear (dimension entities, exploded lines and text, none with a
written scale) and the drawing unit (mm or m).

Tolerances: counts exact, areas ±2 %, lengths ±3 %. A miss is *flagged* when
the engine marked the line below high confidence, *silent* when it reported a
wrong figure confidently, *missing* when no line came back.
