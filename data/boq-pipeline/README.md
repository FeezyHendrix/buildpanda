# DWG → BoQ pipeline (prototype)

Proof-of-concept for an AI-assisted pipeline that takes off quantities from a
construction DWG and produces a priced Bill of Quantities in the project
currency, classified against the Nigerian **BESMM4** standard via RAG.

This is a **standalone prototype** (run with `tsx`), not yet wired into the app.
It exists to validate feasibility and surface the real engineering challenges
before committing to a production `boq-agent` module.

## Pipeline stages

1. **Parse** — `dwgread -O JSON` (LibreDWG) extracts vector geometry. JSON path
   is reliable; `dwg2dxf`/`dwg2SVG` segfault on real files, so we never use them.
2. **Calibrate** — derive the model→mm scale by comparing each linear
   dimension's annotated value to the geometric span of its extension points.
   The median ratio is the scale; a tight cluster means the drawing is
   trustworthy. (Ogudu: scale 1.0, 88% of 1,013 dims agree.)
3. **Take-off** — deterministic measurement per trade/layer. The LLM never
   measures.
4. **Classify (RAG)** — `text-embedding-3-small` over the BESMM4 PDF corpus
   (686 chunks); for each item, retrieve the relevant measurement rules and let
   the LLM assign the BESMM work section, code and unit **from that context**.
5. **Price + write** — seed Nigerian rate card → priced BoQ in the Moniepoint
   sample layout (`S/N | DESCRIPTION | QTY | UNIT | U/PRICE | AMOUNT`, section
   summaries, grand total) + a **Provenance** sheet auditing every number.

## Run

```bash
# from data/boq-pipeline, with backend deps reachable:
ln -sfn ../../packages/backend/node_modules node_modules   # build-only shim
set -a; source ../../.env; set +a                          # OPENAI_API_KEY

# 1) build the BESMM knowledge base (once)
npx --prefix ../../packages/backend tsx kb-extract.ts       # PDFs -> corpus
npx --prefix ../../packages/backend tsx rag.ts              # corpus -> embeddings

# 2) run the pipeline (DWG path, currency)
npx --prefix ../../packages/backend tsx run.ts ../samples/dwg/BOF-AT-Ogudu-ARC1.dwg NGN
# -> data/samples/boq/GENERATED-Ogudu-BoQ-NGN.xlsx
```

## What the prototype proved

- **Scale self-calibration works** on dimensioned Nigerian drawings (no manual
  scale needed).
- **RAG over BESMM4 is accurate** — retrieves the right measurement-rule pages
  (MASONRY p179, in-situ concrete p380, excavation p360) and the LLM refines
  raw items into proper BoQ descriptions, grounded in the standard.
- **Full chain runs end to end**: DWG → priced, BESMM-classified, currency-aware
  BoQ XLSX with a complete audit trail.

## The hard problems it surfaced (must solve for production)

- **Multi-drawing sheets.** A DWG holds many drawings (plans, elevations,
  sections, details) in one model space — ~10 wall clusters in the Ogudu file.
  Summing geometry across all of them overcounts ~10x. Needs spatial clustering
  + the QS choosing which drawing to measure.
- **Polluted layers.** A layer named `WALL` contained 215m "walls" (borders,
  hatching, section lines). Layer names alone aren't trustworthy; geometric
  sanity filters + per-firm layer mapping are required.
- **The missing 3rd dimension.** Heights/thicknesses/specs are never in a 2D
  plan — they are assumptions the agent must surface and the QS must confirm.
- **Counts need block references.** Doors/windows/columns here are drawn as
  geometry, not blocks, so simple INSERT counting misses them.

## Caveats

- Rates in `classify.ts` are **seed values**, not a real rate library.
- Currency switching changes the symbol only; real FX conversion is not applied.
- Output is a **DRAFT for QS review**, never a final bill.

## Phase 1 — drawing segmentation + element signature counting

Fixes the biggest accuracy bug (summing geometry across all drawings on a sheet)
and adds "barcode-style" element counting.

Files: `phase1-cluster.ts`, `phase1-signatures.ts`, `phase1-run.ts`. Run:

```bash
npx --prefix ../../packages/backend tsx phase1-run.ts ../samples/dwg/BOF-AT-Ogudu-ARC1.dwg
```

**1. Segmentation (`phase1-cluster.ts`)** — grid-accelerated DBSCAN over entity
centroids splits the sheet into individual drawings. On the Ogudu file: 12
drawings, of which the four 24.2m x 24.2m clusters are the repeated floor plans.

**2. Classification (`phase1-run.ts`)** — labels each cluster floor-plan /
elevation / detail from aspect ratio + presence of plan elements, then
de-duplicates repeated floors and counts within ONE representative.

**3. Signature matching (`phase1-signatures.ts`)** — the "barcode catalog". Each
element has a geometric signature detected deterministically:
- **Sanitary** → `INSERT` block on sanitary layer (explicit barcode).
- **Columns** → small compact polygon ~150-600mm (the Ogudu columns are a clean
  230x230 RC square).
- **Doors** → swing arc (r 500-1500mm), fallback to door-leaf rectangle.
- **Windows** → opening polyline group on the window layer.

**Result (proves the overcount fix):**

| element | per-plan (correct) | whole-sheet (old bug) |
|---|---|---|
| Structural columns | **28** | 112 (= 28 x 4 floors) |
| Doors | 17 | 1 |
| Windows | 2 | 136 |

Columns are spot-on (28 per floor, not 112). Door/window signatures still need
per-firm threshold calibration — that's the next tuning loop, and exactly where
"learn the firm's drawing conventions once, reuse forever" pays off.

### What Phase 1 establishes

- Multi-drawing sheets are now segmented, not summed — the #1 correctness fix.
- The signature/template approach (barcode idea) works: deterministic counts
  from geometry, no LLM guessing, with confidence per element.
- Counts are taken from one representative floor, not multiplied by floor count.

