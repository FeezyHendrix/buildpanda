// Turning what the QS did into the scale the drawing lands on.
//
// Split out of `editor-operation-commands.ts` at the house 400-line ceiling.

import { BadRequestError } from "../../../lib/errors.ts";

/**
 * The scale the re-calibration lands on. Either stated outright, or derived from
 * a reference line the QS measured on the drawing and the real distance they
 * typed — which is how a paper drawing is actually calibrated. The reference is
 * persisted with the sheet, so the basis of the scale survives the operation.
 */
export function mmPerPtFor(command: {
  mmPerPt?: number;
  reference?: { fromPt: [number, number]; toPt: [number, number]; enteredDistance: number; unit: "mm" | "cm" | "m" };
}): number {
  if (command.mmPerPt !== undefined) {
    if (!(Number.isFinite(command.mmPerPt) && command.mmPerPt > 0)) {
      throw new BadRequestError("A sheet scale must be a positive number of millimetres per point");
    }
    return command.mmPerPt;
  }
  const reference = command.reference;
  // Unconditional. It used to fall back to the scale already in force when the
  // drawing had one, so an apply carrying NEITHER a scale nor a reference was
  // accepted — and the writer then stamped a calibration record, a
  // "Re-calibrated to …" basis and a version bump for a change of nothing. A
  // re-calibration states what the drawing is now measured at; a request that
  // states nothing is not one.
  if (!reference) {
    throw new BadRequestError("Give the new scale, or two points and the real distance between them");
  }
  const spanPt = Math.hypot(reference.toPt[0] - reference.fromPt[0], reference.toPt[1] - reference.fromPt[1]);
  if (!(spanPt > 0)) throw new BadRequestError("The two reference points must be a real distance apart on the drawing");
  const toMm = reference.unit === "m" ? 1000 : reference.unit === "cm" ? 10 : 1;
  const mm = reference.enteredDistance * toMm;
  if (!(Number.isFinite(mm) && mm > 0)) throw new BadRequestError("The entered distance must be a positive length");
  return mm / spanPt;
}
