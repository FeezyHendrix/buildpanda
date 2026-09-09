import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import type { ExtractionReport, GeoSummary, LayerElement } from "@/api/precon";
import { cn } from "@/lib/utils";

// "What Panda AI found": the parser's account of a drawing before any rule
// decides what to measure. Units and how they were decided, every layer with
// what today's rules would treat it as, blocks, dimensions, what could not be
// read, and how much of the geometry a measuring rule will actually consume.

const ELEMENT_LABEL: Record<LayerElement, string> = {
  walls: "Walls",
  columns: "Columns",
  doors: "Doors",
  windows: "Windows",
  sanitary: "Sanitary",
  stairs: "Stairs",
  roof: "Roof",
  furniture: "Furniture",
  dimensions: "Dimensions",
  text: "Text",
  grid: "Grid",
  ignore: "Ignored",
  levels: "Levels",
  auto: "Auto",
};

const MEASURED: ReadonlySet<LayerElement> = new Set(["walls", "columns", "doors", "windows", "sanitary"]);

const elementTone = (element: LayerElement): BadgeTone => (MEASURED.has(element) ? "success" : element === "ignore" ? "neutral" : "info");

const UNIT_LABEL: Record<string, string> = { mm: "millimetres", cm: "centimetres", m: "metres", in: "inches", ft: "feet", unknown: "page points" };

function unitsTone(confidence: number): BadgeTone {
  return confidence >= 0.8 ? "success" : confidence >= 0.5 ? "warning" : "danger";
}

function formatDim(value: number | null): string {
  if (value === null) return "—";
  return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(2);
}

export function ExtractionSummary({ summary }: { summary: GeoSummary }) {
  const pct = Math.round(summary.coverage.measuredShare * 100);
  return (
    <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-[11px] text-gray-600">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-800">What Panda AI found</span>
        <Badge tone={unitsTone(summary.units.confidence)} size="sm">
          {UNIT_LABEL[summary.units.unit] ?? summary.units.unit} · {summary.units.basis}
        </Badge>
      </div>
      <p>
        {summary.totals.segments.toLocaleString()} lines · {summary.totals.shapes.toLocaleString()} closed shapes · {summary.totals.inserts.toLocaleString()} blocks ·{" "}
        {summary.totals.dimensions.toLocaleString()} dimensions · {summary.totals.texts.toLocaleString()} texts
      </p>
      <p className={cn(pct < 50 ? "text-amber-700" : "text-gray-600")}>
        {pct}% of the geometry sits on a layer a measuring rule reads
        {summary.unreadable > 0 ? ` · ${summary.unreadable.toLocaleString()} entities not readable` : ""}
      </p>
      {summary.warnings.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-amber-700">
          {summary.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
ExtractionSummary.displayName = "ExtractionSummary";

function LayerTable({ layers }: { layers: ExtractionReport["layers"] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">Layer</th>
            <th className="px-3 py-1.5 text-right font-medium">Entities</th>
            <th className="px-3 py-1.5 text-left font-medium">Contents</th>
            <th className="px-3 py-1.5 text-left font-medium">Treated as</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((layer) => (
            <tr key={layer.name} className="border-t border-gray-100">
              <td className="px-3 py-1.5 font-mono text-[11px] text-gray-800">{layer.name}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{layer.count.toLocaleString()}</td>
              <td className="px-3 py-1.5 text-gray-500">
                {Object.entries(layer.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => `${n} ${type}`)
                  .join(" · ")}
              </td>
              <td className="px-3 py-1.5">
                <Badge tone={elementTone(layer.element)} size="sm">
                  {ELEMENT_LABEL[layer.element]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
LayerTable.displayName = "LayerTable";

export function ExtractionReportPanel({ report, title }: { report: ExtractionReport; title?: string }) {
  const pct = Math.round(report.coverage.measuredShare * 100);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">What Panda AI found{title ? ` · ${title}` : ""}</h3>
          <p className="text-xs text-gray-500">Recorded before anything is measured, so nothing can be dropped silently.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={unitsTone(report.units.confidence)}>
            {UNIT_LABEL[report.units.unit] ?? report.units.unit} · from {report.units.basis} · {Math.round(report.units.confidence * 100)}%
          </Badge>
          <Badge tone={pct >= 50 ? "success" : "warning"}>{pct}% of geometry measurable</Badge>
        </div>
      </div>
      <p className="text-xs text-gray-500">{report.units.note}</p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Lines", report.totals.segments],
            ["Closed shapes", report.totals.shapes],
            ["Arcs", report.totals.arcs],
            ["Block inserts", report.totals.inserts],
            ["Dimensions", report.totals.dimensions],
            ["Texts", report.totals.texts],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-mono text-sm tabular-nums text-gray-900">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      {report.warnings.length > 0 ? (
        <ul className="list-disc space-y-0.5 rounded-lg bg-amber-50 px-6 py-2 text-xs text-amber-800">
          {report.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-gray-700">Layers</h4>
        <LayerTable layers={report.layers} />
        <p className="mt-1 text-[11px] text-gray-400">
          "Treated as" is what today's measuring rules do with the layer. Ignored layers are not measured. Measured layers: {report.coverage.measuredLayers.join(", ") || "none"}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-gray-700">Blocks</h4>
          {report.blocks.length === 0 ? (
            <p className="text-xs text-gray-400">No block inserts.</p>
          ) : (
            <ul className="space-y-0.5 text-xs">
              {report.blocks.slice(0, 12).map((b) => (
                <li key={b.name} className="flex justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-gray-800">{b.name}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">×{b.inserts}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-gray-700">Dimensions</h4>
          <p className="text-xs text-gray-600">
            {report.dimensions.count.toLocaleString()} found
            {report.dimensions.count > 0 ? ` · ${formatDim(report.dimensions.min)} to ${formatDim(report.dimensions.max)} · median ${formatDim(report.dimensions.median)}` : ""}
          </p>
          {report.extents ? (
            <p className="mt-1 text-xs text-gray-500">
              Extents {formatDim(report.extents.width)} × {formatDim(report.extents.height)} {report.units.unit === "unknown" ? "pt" : report.units.unit}
            </p>
          ) : null}
          <h4 className="mb-1.5 mt-3 text-xs font-semibold text-gray-700">Frequent text</h4>
          <p className="text-xs text-gray-600">
            {report.texts
              .slice(0, 10)
              .map((t) => `${t.text}${t.count > 1 ? ` ×${t.count}` : ""}`)
              .join(" · ") || "None"}
          </p>
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-gray-700">Not readable</h4>
          {report.unreadable.length === 0 ? (
            <p className="text-xs text-gray-400">Everything in the model space was read.</p>
          ) : (
            <ul className="space-y-1 text-xs text-gray-600">
              {report.unreadable.map((u) => (
                <li key={u.what}>
                  <span className="font-mono text-[11px] text-gray-800">{u.what}</span> ×{u.count.toLocaleString()} · {u.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
ExtractionReportPanel.displayName = "ExtractionReportPanel";
