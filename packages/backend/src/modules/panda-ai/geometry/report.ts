import type { ExtractionDimensions, ExtractionLayerRow, ExtractionReport, ExtractionTotals, GeoDocument, GeoSummary, LayerElement } from "./types.ts";

// What each layer would be treated as by the measuring rules that exist today.
// These are the engines' own tests, copied here so the report tells the truth
// about what the current run will use and what it will silently skip. The
// order matters: the DWG engine drops noise layers before it looks for walls.
const LAYER_RULES: [RegExp, LayerElement][] = [
  [/dim|defpoint/i, "dimensions"],
  [/text|anno|note/i, "text"],
  [/grid|axis/i, "grid"],
  [/wall/i, "walls"],
  [/column|stanchion|pillar/i, "columns"],
  [/door/i, "doors"],
  [/wind/i, "windows"],
  [/sanitar|toilet|plumb/i, "sanitary"],
  [/stair|step/i, "stairs"],
  [/roof/i, "roof"],
  [/furn|fixture/i, "furniture"],
];

// Elements a measuring rule actually consumes today; the rest is coverage lost.
const CONSUMED: ReadonlySet<LayerElement> = new Set(["walls", "columns", "doors", "windows", "sanitary"]);

export function elementForLayer(name: string): LayerElement {
  for (const [pattern, element] of LAYER_RULES) if (pattern.test(name)) return element;
  return "ignore";
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? null;
}

function dimensionStats(doc: GeoDocument): ExtractionDimensions {
  const values = doc.dimensions.map((d) => d.value).filter((v) => Number.isFinite(v) && v > 0);
  return {
    count: doc.dimensions.length,
    min: values.length ? Math.min(...values) : null,
    median: median(values),
    max: values.length ? Math.max(...values) : null,
  };
}

function extents(doc: GeoDocument): ExtractionReport["extents"] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const s of doc.segments) {
    grow(s.x1, s.y1);
    grow(s.x2, s.y2);
  }
  for (const sh of doc.shapes) for (const p of sh.points) grow(p[0]!, p[1]!);
  for (const i of doc.inserts) grow(i.x, i.y);
  if (!Number.isFinite(minX)) return null;
  return { width: maxX - minX, height: maxY - minY };
}

export function buildReport(doc: GeoDocument): ExtractionReport {
  const byLayer = new Map<string, ExtractionLayerRow>();
  const row = (name: string | null): ExtractionLayerRow => {
    const key = name ?? "(no layer)";
    const existing = byLayer.get(key);
    if (existing) return existing;
    const created: ExtractionLayerRow = {
      name: key,
      count: 0,
      color: doc.layers.find((l) => l.name === key)?.color ?? null,
      element: name ? elementForLayer(name) : "ignore",
      byType: {},
    };
    byLayer.set(key, created);
    return created;
  };
  const tally = (layer: string | null, type: string) => {
    const r = row(layer);
    r.count += 1;
    r.byType[type] = (r.byType[type] ?? 0) + 1;
  };
  // polyline edges share a base id ("handle:k"); they count once, as their parent
  const seenSegment = new Set<string>();
  for (const s of doc.segments) {
    const base = s.id.includes(":") ? s.id.slice(0, s.id.indexOf(":")) : s.id;
    if (seenSegment.has(base)) continue;
    seenSegment.add(base);
    tally(s.layer, s.fill ? "fill" : s.source && s.source !== "LINE" ? "polyline-edges" : "line");
  }
  for (const s of doc.shapes) tally(s.layer, s.kind);
  for (const a of doc.arcs) tally(a.layer, "arc");
  for (const i of doc.inserts) tally(i.layer, "insert");
  for (const t of doc.texts) tally(t.layer, t.kind);
  for (const d of doc.dimensions) tally(d.layer, "dimension");

  const totals: ExtractionTotals = {
    segments: doc.segments.length,
    shapes: doc.shapes.length,
    arcs: doc.arcs.length,
    inserts: doc.inserts.length,
    texts: doc.texts.length,
    dimensions: doc.dimensions.length,
    all: doc.segments.length + doc.shapes.length + doc.arcs.length + doc.inserts.length + doc.texts.length + doc.dimensions.length,
  };

  // Coverage counts geometry only: text and dimensions are read for scale and
  // labels, not measured, so they neither help nor hurt the share.
  let geometry = 0;
  let consumed = 0;
  const measuredLayers = new Set<string>();
  const ignoredLayers = new Set<string>();
  const geometryOf = (layer: string | null) => {
    const r = row(layer);
    return (
      (r.byType["line"] ?? 0) +
      (r.byType["fill"] ?? 0) +
      (r.byType["polyline-edges"] ?? 0) +
      (r.byType["polyline"] ?? 0) +
      (r.byType["hatch"] ?? 0) +
      (r.byType["circle"] ?? 0) +
      (r.byType["arc"] ?? 0) +
      (r.byType["insert"] ?? 0)
    );
  };
  for (const r of byLayer.values()) {
    const g = geometryOf(r.name === "(no layer)" ? null : r.name);
    if (g === 0) continue;
    geometry += g;
    if (CONSUMED.has(r.element)) {
      consumed += g;
      measuredLayers.add(r.name);
    } else ignoredLayers.add(r.name);
  }

  const textCounts = new Map<string, number>();
  for (const t of doc.texts) {
    const key = t.text.toUpperCase().slice(0, 80);
    textCounts.set(key, (textCounts.get(key) ?? 0) + 1);
  }
  const texts = [...textCounts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const warnings: string[] = [];
  if (doc.units.basis === "assumed") warnings.push(`Units are assumed (${doc.units.unit}); check a known dimension before trusting quantities`);
  if (doc.source === "dwg" && doc.dimensions.length === 0) warnings.push("No dimensions in the model space; scale cannot be cross-checked");
  if (doc.source === "pdf" && doc.layers.length === 0) warnings.push("No layers survived the PDF export; walls and dimensions are told apart by line weight only");
  if (geometry > 0 && consumed / geometry < 0.5) warnings.push(`Only ${Math.round((consumed / geometry) * 100)}% of the geometry is on a layer a measuring rule reads`);
  const proxies = doc.unreadable.filter((u) => /proxy/i.test(u.what)).reduce((n, u) => n + u.count, 0);
  if (proxies > 0) warnings.push(`${proxies} proxy objects could not be read; walls drawn with an add-on may be missing`);
  const xrefs = doc.unreadable.filter((u) => u.what === "xref");
  if (xrefs.length > 0) warnings.push(`${xrefs.reduce((n, u) => n + u.count, 0)} external references are not in this file`);

  return {
    source: doc.source,
    units: doc.units,
    totals,
    layers: [...byLayer.values()].sort((a, b) => b.count - a.count),
    blocks: doc.blocks.slice(0, 40),
    dimensions: dimensionStats(doc),
    texts,
    unreadable: doc.unreadable,
    coverage: {
      measuredShare: geometry === 0 ? 0 : Math.round((consumed / geometry) * 1000) / 1000,
      measuredLayers: [...measuredLayers].sort(),
      ignoredLayers: [...ignoredLayers].sort(),
    },
    extents: extents(doc),
    warnings,
  };
}

export function summarise(report: ExtractionReport): GeoSummary {
  return {
    source: report.source,
    units: report.units,
    totals: report.totals,
    coverage: report.coverage,
    topLayers: report.layers.slice(0, 6).map((l) => ({ name: l.name, count: l.count, element: l.element })),
    dimensions: report.dimensions,
    unreadable: report.unreadable.reduce((n, u) => n + u.count, 0),
    warnings: report.warnings,
  };
}
