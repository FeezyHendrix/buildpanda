// Which fields each command REQUIRES, as one conditional per kind.
//
// Split out of `editor-operation-schemas.ts` at the house 400-line ceiling. It
// is deliberately a list of `if kind is X then require Y`: a single flat
// `required` cannot express that a merge needs `rowIds` while a re-cut needs
// `geometryId`, and the alternative — one schema per command — would let two of
// them drift apart on the fields they share.

export const commandRequired = [
    {
      if: { properties: { kind: { const: "create-geometry" } }, required: ["kind"] },
      then: {
        required: ["kind", "sheetId", "tool", "description", "elementGroup"],
        anyOf: [{ required: ["vertices"] }, { required: ["shape"] }],
      },
    },
    // A redraw declares its outline as `shape` OR as `vertices`; the server
    // derives the other. Sending both, disagreeing, is refused by the writer.
    {
      if: { properties: { kind: { const: "update-geometry" } }, required: ["kind"] },
      then: {
        required: ["kind", "geometryId"],
        anyOf: [{ required: ["vertices"] }, { required: ["shape"] }],
      },
    },
    {
      if: { properties: { kind: { const: "batch" } }, required: ["kind"] },
      then: { required: ["kind", "commands"] },
    },
    {
      if: { properties: { kind: { const: "rebind-geometry" } }, required: ["kind"] },
      then: { required: ["kind", "geometryId", "scaleChoice"] },
    },
    {
      if: { properties: { kind: { const: "delete-geometry" } }, required: ["kind"] },
      then: { required: ["kind", "geometryId"] },
    },
    {
      if: { properties: { kind: { const: "set-row-factor" } }, required: ["kind"] },
      then: { required: ["kind", "rowId"] },
    },
    {
      if: { properties: { kind: { const: "set-row-typical" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "typical"] },
    },
    {
      if: { properties: { kind: { const: "set-measurement-settings" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "repeatLabels"] },
    },
    {
      if: { properties: { kind: { const: "split-repeat-exception" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "label", "confirmed"] },
    },
    {
      if: { properties: { kind: { const: "add-deduction" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "label"] },
    },
    {
      if: { properties: { kind: { const: "edit-deduction" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId"] },
    },
    {
      if: { properties: { kind: { const: "remove-deduction" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId"] },
    },
    {
      if: { properties: { kind: { const: "confirm-measurement-basis" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId", "tool"] },
    },
    {
      if: { properties: { kind: { const: "edit-markup" } }, required: ["kind"] },
      then: { required: ["kind", "markupId", "version"] },
    },
    {
      if: { properties: { kind: { const: "delete-markup" } }, required: ["kind"] },
      then: { required: ["kind", "markupId", "version"] },
    },
    {
      if: { properties: { kind: { const: "restore-markup" } }, required: ["kind"] },
      then: { required: ["kind", "markupId"] },
    },
    {
      if: { properties: { kind: { const: "edit-comment" } }, required: ["kind"] },
      then: { required: ["kind", "markupId", "commentId", "version", "body"] },
    },
    {
      if: { properties: { kind: { const: "set-overlay" } }, required: ["kind"] },
      then: { required: ["kind", "sheetId", "overlay"] },
    },
    {
      if: { properties: { kind: { const: "apply-calibration" } }, required: ["kind"] },
      then: { required: ["kind", "sheetId"] },
    },
    {
      if: { properties: { kind: { const: "apply-viewports" } }, required: ["kind"] },
      then: { required: ["kind", "sheetId", "viewports"] },
    },
    {
      if: { properties: { kind: { const: "split-polyline" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId", "vertexIndex"] },
    },
    {
      if: { properties: { kind: { const: "remove-segment" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId", "segmentIndex"] },
    },
    {
      if: { properties: { kind: { const: "duplicate-geometry" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId", "offset"] },
    },
    {
      if: { properties: { kind: { const: "transform-geometry" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId"] },
    },
    {
      if: { properties: { kind: { const: "split-polygon" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "geometryId", "cut"] },
    },
    {
      if: { properties: { kind: { const: "create-assembly" } }, required: ["kind"] },
      then: { required: ["kind", "sheetId", "assemblyId", "tool", "vertices"] },
    },
    {
      if: { properties: { kind: { const: "duplicate-row" } }, required: ["kind"] },
      then: { required: ["kind", "rowId"] },
    },
    {
      if: { properties: { kind: { const: "merge-geometries" } }, required: ["kind"] },
      then: { required: ["kind", "rowIds"] },
    },
    {
      if: { properties: { kind: { const: "reassign-geometry" } }, required: ["kind"] },
      then: { required: ["kind", "geometryId", "targetRowId"] },
    },
    // Both preconditions are REQUIRED, not optional hardening: without them the
    // index alone would resolve to whatever now sits in that slot.
    {
      if: { properties: { kind: { const: "edit-stated-deduction" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "rowVersion", "index", "expect", "qty", "unit", "unitConfirmed"] },
    },
    {
      if: { properties: { kind: { const: "remove-stated-deduction" } }, required: ["kind"] },
      then: { required: ["kind", "rowId", "rowVersion", "index", "expect"] },
    },
] as const;
