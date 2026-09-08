import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runDwgTakeoff } from "../dwg-takeoff/engine.ts";
import { measurePdfFile } from "../pdf-takeoff/engine/measure-file.ts";
import { scoreDwg, scorePdf, summarise, type Scored, type Summary } from "./compare.ts";
import { CONVENTIONS } from "./conventions.ts";
import { FIXTURES_ROOT, fixturePaths, generateFixture, hasDwgwrite, type Fixture } from "./generate.ts";
import { FAMILIES, type Convention, type Family, type Truth } from "./types.ts";

// Runs both engines over every fixture and writes results.json plus a
// markdown summary. Baseline-recording only: nothing here fails the build.

export interface FixtureResult {
  id: string;
  family: Family;
  convention: string;
  dwg: { ran: boolean; error: string | null; ms: number; scored: Scored[]; summary: Summary; raw: unknown };
  pdf: { ran: boolean; error: string | null; ms: number; scored: Scored[]; summary: Summary; pages: unknown };
}

export interface BenchmarkResults {
  generatedAt: string;
  fixtures: FixtureResult[];
  totals: { dwg: Summary; pdf: Summary };
  byFamily: Record<string, { dwg: Summary; pdf: Summary }>;
  byConvention: Record<string, { dwg: Summary; pdf: Summary }>;
  byElement: Record<string, { dwg: Summary; pdf: Summary }>;
  ogudu: unknown;
}

async function readTruth(fixture: Fixture): Promise<Truth> {
  return JSON.parse(await fs.readFile(fixture.truthPath, "utf8")) as Truth;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null; ms: number }> {
  const t0 = Date.now();
  try {
    return { value: await fn(), error: null, ms: Date.now() - t0 };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message.split("\n")[0]! : String(error), ms: Date.now() - t0 };
  }
}

export async function runFixture(fixture: Fixture, truth: Truth): Promise<FixtureResult> {
  const dwgRun = await timed(async () => {
    await fs.access(fixture.dwg);
    return runDwgTakeoff(fixture.dwg);
  });
  const dwgScored = dwgRun.value ? scoreDwg(truth, dwgRun.value) : scoreDwg(truth, []);
  const pdfRun = await timed(async () => {
    await fs.access(fixture.pdf);
    return measurePdfFile(fixture.pdf);
  });
  const pdfScored = pdfRun.value ? scorePdf(truth, pdfRun.value) : scorePdf(truth, []);
  return {
    id: fixture.id,
    family: fixture.family,
    convention: fixture.convention.id,
    dwg: { ran: dwgRun.value !== null, error: dwgRun.error, ms: dwgRun.ms, scored: dwgScored, summary: summarise(dwgScored), raw: dwgRun.value ? { scaleToMm: dwgRun.value.scaleToMm, scaleConfidence: dwgRun.value.scaleConfidence, drawings: dwgRun.value.drawings, items: dwgRun.value.items, notes: dwgRun.value.notes, walls: dwgRun.value.wallSummaries ?? [] } : null },
    pdf: {
      ran: pdfRun.value !== null,
      error: pdfRun.error,
      ms: pdfRun.ms,
      scored: pdfScored,
      summary: summarise(pdfScored),
      pages: pdfRun.value?.map((p) => ({ page: p.pageNumber, kind: p.kind, title: p.title, segments: p.segments, scale: p.calibration ? Math.round(p.calibration.mmPerPt / 0.3528) : null, confidence: p.calibration?.confidence ?? null, items: p.items.map((i) => ({ group: i.elementGroup, description: i.description, qty: i.qty, unit: i.unit, confidence: i.confidence })), note: p.note })) ?? null,
    },
  };
}

function groupSummaries(results: FixtureResult[], keyOf: (r: FixtureResult) => string): Record<string, { dwg: Summary; pdf: Summary }> {
  const groups = new Map<string, { dwg: Scored[]; pdf: Scored[] }>();
  for (const r of results) {
    const key = keyOf(r);
    const g = groups.get(key) ?? { dwg: [], pdf: [] };
    g.dwg.push(...r.dwg.scored);
    g.pdf.push(...r.pdf.scored);
    groups.set(key, g);
  }
  return Object.fromEntries([...groups.entries()].map(([k, g]) => [k, { dwg: summarise(g.dwg), pdf: summarise(g.pdf) }]));
}

function elementSummaries(results: FixtureResult[]): Record<string, { dwg: Summary; pdf: Summary }> {
  const groups = new Map<string, { dwg: Scored[]; pdf: Scored[] }>();
  for (const r of results) {
    for (const s of r.dwg.scored) (groups.get(s.element) ?? groups.set(s.element, { dwg: [], pdf: [] }).get(s.element)!).dwg.push(s);
    for (const s of r.pdf.scored) (groups.get(s.element) ?? groups.set(s.element, { dwg: [], pdf: [] }).get(s.element)!).pdf.push(s);
  }
  return Object.fromEntries([...groups.entries()].map(([k, g]) => [k, { dwg: summarise(g.dwg), pdf: summarise(g.pdf) }]));
}

const pct = (s: Summary) => `${s.withinShare}% within (${s.within}/${s.lines}) · failures flagged ${s.failuresFlaggedShare}% · missing ${s.missing}`;

export function renderMarkdown(results: BenchmarkResults): string {
  const lines: string[] = ["# Take-off benchmark", "", `Generated ${results.generatedAt}. Tolerances: counts exact, areas ±2 %, lengths ±3 %.`, "", "## Totals", "", `- DWG engine: ${pct(results.totals.dwg)}`, `- PDF engine: ${pct(results.totals.pdf)}`, "", "## By family", "", "| Family | DWG | PDF |", "|---|---|---|"];
  for (const [k, v] of Object.entries(results.byFamily)) lines.push(`| ${k} | ${pct(v.dwg)} | ${pct(v.pdf)} |`);
  lines.push("", "## By convention", "", "| Convention | DWG | PDF |", "|---|---|---|");
  for (const [k, v] of Object.entries(results.byConvention)) lines.push(`| ${k} | ${pct(v.dwg)} | ${pct(v.pdf)} |`);
  lines.push("", "## By element", "", "| Element | DWG | PDF |", "|---|---|---|");
  for (const [k, v] of Object.entries(results.byElement)) lines.push(`| ${k} | ${pct(v.dwg)} | ${pct(v.pdf)} |`);
  lines.push("", "## Fixtures", "", "| Fixture | DWG | PDF |", "|---|---|---|");
  for (const r of results.fixtures) lines.push(`| ${r.id} | ${r.dwg.ran ? pct(r.dwg.summary) : `failed: ${r.dwg.error}`} | ${r.pdf.ran ? pct(r.pdf.summary) : `failed: ${r.pdf.error}`} |`);
  if (results.ogudu) lines.push("", "## Ogudu (real drawing)", "", "```json", JSON.stringify(results.ogudu, null, 1).slice(0, 4000), "```");
  return lines.join("\n") + "\n";
}

export interface RunOptions {
  root?: string;
  families?: readonly Family[];
  conventions?: readonly Convention[];
  regenerate?: boolean;
  oguduPath?: string | null;
}

export async function runBenchmark(opts: RunOptions = {}): Promise<BenchmarkResults> {
  const root = opts.root ?? FIXTURES_ROOT;
  const families = opts.families ?? FAMILIES;
  const conventions = opts.conventions ?? CONVENTIONS;
  const canWriteDwg = await hasDwgwrite();
  const results: FixtureResult[] = [];
  for (const family of families) {
    for (const convention of conventions) {
      const fixture = fixturePaths(root, family, convention);
      const needs = opts.regenerate || !(await fs.access(fixture.truthPath).then(() => true, () => false)) || !(await fs.access(fixture.pdf).then(() => true, () => false));
      const truth = needs ? (await generateFixture(family, convention, { root, binaries: true })).truth : await readTruth(fixture);
      if (!canWriteDwg) await fs.rm(fixture.dwg, { force: true });
      results.push(await runFixture(fixture, truth));
    }
  }
  let ogudu: unknown = null;
  const oguduPath = opts.oguduPath === undefined ? "/tmp/probe.dwg" : opts.oguduPath;
  if (oguduPath && (await fs.access(oguduPath).then(() => true, () => false))) {
    const run = await timed(() => runDwgTakeoff(oguduPath));
    ogudu = run.value ? { ms: run.ms, scaleToMm: run.value.scaleToMm, scaleConfidence: run.value.scaleConfidence, walls: run.value.wallSummaries ?? [], drawings: run.value.drawings, items: run.value.items } : { error: run.error };
  }
  const all = { dwg: results.flatMap((r) => r.dwg.scored), pdf: results.flatMap((r) => r.pdf.scored) };
  const out: BenchmarkResults = {
    generatedAt: new Date().toISOString(),
    fixtures: results,
    totals: { dwg: summarise(all.dwg), pdf: summarise(all.pdf) },
    byFamily: groupSummaries(results, (r) => r.family),
    byConvention: groupSummaries(results, (r) => r.convention),
    byElement: elementSummaries(results),
    ogudu,
  };
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "..", "results.json"), JSON.stringify(out, null, 2), "utf8");
  await fs.writeFile(path.join(root, "..", "results.md"), renderMarkdown(out), "utf8");
  return out;
}

if (process.argv[1] && /run\.ts$/.test(process.argv[1])) {
  const regenerate = process.argv.includes("--regenerate");
  runBenchmark({ regenerate })
    .then((r) => {
      process.stdout.write(renderMarkdown(r));
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exit(1);
    });
}
