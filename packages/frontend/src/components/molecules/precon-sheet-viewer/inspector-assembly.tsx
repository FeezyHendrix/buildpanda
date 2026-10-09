import type { AssemblySnapshot } from "@/api/precon-row-types";

interface Props {
  /** The snapshot frozen onto this line's own shape when it was drawn. */
  assembly: AssemblySnapshot;
  /** The base quantity the shape measures, in its own unit — the figure the factor multiplies. */
  base: { quantity: number | null; unit: string | null };
}

function factorSentence(assembly: AssemblySnapshot, base: Props["base"]): string {
  const per = base.unit ? `per ${base.unit}` : "per measured unit";
  const measured = base.quantity === null || !base.unit ? null : `${base.quantity} ${base.unit}`;
  return measured
    ? `${measured} drawn × ${assembly.factor} ${assembly.unit} ${per}`
    : `× ${assembly.factor} ${assembly.unit} ${per}`;
}

/**
 * Why this line exists and what editing it does.
 *
 * An assembly puts several lines in the bill from ONE drawn shape, and each of
 * them is a bill line in its own right: the item's name, unit and factor were
 * copied onto this line's shape when it was drawn and are never re-read from
 * the rate library. Without saying so, a reader reasonably assumes the lines
 * are linked and that correcting this shape restates its siblings too.
 */
export function InspectorAssembly({ assembly, base }: Props) {
  return (
    <div className="rounded-md border border-line-hair bg-surface-alt p-2" data-assembly-line data-assembly-id={assembly.assemblyId}>
      <p className="text-xs font-semibold text-gray-900">Independent assembly line</p>
      <p className="mt-0.5 text-xs text-gray-600">
        Drawn as <span className="font-medium text-gray-800">{assembly.description}</span> from the assembly{" "}
        <span className="font-medium text-gray-800">{assembly.assemblyName}</span> — {factorSentence(assembly, base)}.
      </p>
      <p className="mt-1 text-xs text-gray-600">
        That recipe was copied onto this line when it was drawn. Editing, re-measuring or deleting this line changes only this line; the
        assembly&rsquo;s other lines keep their own recorded basis, and later changes to the assembly do not restate it.
      </p>
    </div>
  );
}
InspectorAssembly.displayName = "InspectorAssembly";
