import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import { hireDays, optionalText, parseExtensions, requiredText, toEquipmentRequest } from "./mappers.ts";
import type {
  CreateEquipmentRequestInput,
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestRow,
  EquipmentRequestStatus,
  ExtendHireInput,
  UpdateEquipmentRequestInput,
} from "./types.ts";

export interface EquipmentServiceDeps {
  supplierName?: (projectId: string, supplierId: string) => Promise<string | null>;
}

const EQUIPMENT_FORWARD: Record<EquipmentRequestStatus, EquipmentRequestStatus[]> = {
  Draft: ["Requested", "Cancelled", "Rejected"],
  Requested: ["Approved", "Cancelled", "Rejected"],
  Approved: ["Scheduled", "Cancelled", "Rejected"],
  Scheduled: ["OnHire", "Cancelled", "Rejected"],
  OnHire: ["Returned", "Cancelled"],
  Returned: [],
  Cancelled: [],
  Rejected: [],
};

const REASON_REQUIRED: EquipmentRequestStatus[] = ["Cancelled", "Rejected"];

function money(value: number | undefined): string {
  return String(value ?? 0);
}

function assertEquipmentTransition(from: EquipmentRequestStatus, to: EquipmentRequestStatus): void {
  if (from === to) return;
  if (!EQUIPMENT_FORWARD[from].includes(to)) {
    throw new ConflictError(`Cannot move equipment request from ${from} to ${to}`);
  }
}

function assertDateOrder(start: string, end: string, label: string): void {
  if (new Date(start) > new Date(end)) {
    throw new BadRequestError(`${label} end must be on or after start`);
  }
}

/** Plant hire is priced per day on hire; the estimate follows the period. */
function hireCost(
  dailyRate: number | null,
  from: string | null,
  to: string | null,
  fallback: string,
): string {
  if (dailyRate === null) return fallback;
  const days = hireDays(from, to);
  if (days === null) return fallback;
  return String(Math.round(dailyRate * days * 100) / 100);
}

export function equipmentRequestService(
  repository: MaterialsEquipmentRepository,
  deps: EquipmentServiceDeps = {},
) {
  async function equipmentRow(projectId: string, requestId: string): Promise<EquipmentRequestRow> {
    const row = await repository.findEquipmentRequest(requestId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Equipment request");
    return row;
  }

  async function resolveSupplier(
    projectId: string,
    supplierId: string | null | undefined,
    fallback: string | null | undefined,
  ): Promise<{ supplier_id: string | null; supplier: string | null }> {
    if (supplierId) {
      const name = deps.supplierName ? await deps.supplierName(projectId, supplierId) : null;
      if (deps.supplierName && !name) throw new BadRequestError("Supplier is not on this project's register");
      return { supplier_id: supplierId, supplier: name ?? optionalText(fallback) ?? null };
    }
    return { supplier_id: null, supplier: optionalText(fallback) ?? null };
  }

  return {
    async listEquipmentRequests(projectId: string, bucket?: EquipmentBucket): Promise<EquipmentRequest[]> {
      const rows = await repository.listEquipmentRequests(projectId, bucket);
      return rows.map(toEquipmentRequest);
    },

    async getEquipmentRequest(projectId: string, requestId: string): Promise<EquipmentRequest> {
      return toEquipmentRequest(await equipmentRow(projectId, requestId));
    },

    async createEquipmentRequest(
      projectId: string,
      input: CreateEquipmentRequestInput,
      userId: string,
    ): Promise<EquipmentRequest> {
      assertDateOrder(input.neededFrom, input.neededUntil, "Equipment rental");
      const supplier = await resolveSupplier(projectId, input.supplierId, input.supplier);
      const dailyRate = input.dailyRate ?? null;
      const row = await repository.createEquipmentRequest({
        id: generateId("er"),
        project_id: projectId,
        title: requiredText(input.title),
        equipment_name: requiredText(input.equipmentName),
        equipment_type: requiredText(input.equipmentType),
        quantity: input.quantity ?? 1,
        ...supplier,
        status: input.status ?? "Requested",
        priority: input.priority ?? "Normal",
        phase_id: input.phaseId ?? null,
        activity_id: input.activityId ?? null,
        document_id: input.documentId ?? null,
        requested_by_id: userId,
        needed_from: input.neededFrom,
        needed_until: input.neededUntil,
        mobilized_at: input.mobilizedAt ?? null,
        returned_at: input.returnedAt ?? null,
        on_hire_at: input.onHireAt ?? null,
        off_hire_at: input.offHireAt ?? null,
        plant_ref: optionalText(input.plantRef) ?? null,
        daily_rate: dailyRate === null ? null : String(dailyRate),
        extensions: JSON.stringify([]),
        estimated_cost: hireCost(
          dailyRate,
          input.onHireAt ?? input.neededFrom,
          input.offHireAt ?? input.neededUntil,
          money(input.estimatedCost),
        ),
        actual_cost: money(input.actualCost),
        currency: input.currency ?? "NGN",
        delivery_location: optionalText(input.deliveryLocation) ?? null,
        operator_required: input.operatorRequired ? "Yes" : "No",
        notes: optionalText(input.notes) ?? null,
        cancel_reason: null,
        rejected_reason: null,
      });
      return toEquipmentRequest(row);
    },

    async updateEquipmentRequest(
      projectId: string,
      requestId: string,
      input: UpdateEquipmentRequestInput,
    ): Promise<EquipmentRequest> {
      const current = await equipmentRow(projectId, requestId);
      const reason = optionalText(input.reason) ?? null;
      if (input.status) {
        assertEquipmentTransition(current.status, input.status);
        if (REASON_REQUIRED.includes(input.status) && !reason) {
          throw new BadRequestError(
            `A ${input.status.toLowerCase()} equipment request must say why — record the reason`,
          );
        }
        // Plant is off hire from a date, and the reconciliation is built from
        // it: "Returned" with no off-hire date is an unpriceable record.
        if (input.status === "Returned") {
          const offHire = input.offHireAt ?? current.off_hire_at;
          if (!offHire) {
            throw new BadRequestError("Record the off-hire date the plant came back");
          }
        }
      }

      const start = input.neededFrom ?? current.needed_from;
      const end = input.neededUntil ?? current.needed_until;
      assertDateOrder(start, end, "Equipment rental");

      const onHire = input.onHireAt ?? current.on_hire_at ?? start;
      const offHire = input.offHireAt ?? current.off_hire_at ?? end;
      const dailyRate =
        input.dailyRate !== undefined
          ? input.dailyRate
          : current.daily_rate === null
            ? null
            : Number(current.daily_rate);
      const repriced =
        dailyRate !== null &&
        (input.dailyRate !== undefined ||
          input.onHireAt !== undefined ||
          input.offHireAt !== undefined ||
          input.neededFrom !== undefined ||
          input.neededUntil !== undefined);

      const row = await repository.updateEquipmentRequest(requestId, {
        ...(input.title !== undefined ? { title: requiredText(input.title) } : {}),
        ...(input.equipmentName !== undefined ? { equipment_name: requiredText(input.equipmentName) } : {}),
        ...(input.equipmentType !== undefined ? { equipment_type: requiredText(input.equipmentType) } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.supplierId !== undefined || input.supplier !== undefined
          ? await resolveSupplier(projectId, input.supplierId ?? current.supplier_id, input.supplier)
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === "Cancelled" ? { cancel_reason: reason } : {}),
        ...(input.status === "Rejected" ? { rejected_reason: reason } : {}),
        ...(input.status === "Returned" && !current.returned_at
          ? { returned_at: input.returnedAt ?? offHire }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.phaseId !== undefined ? { phase_id: input.phaseId } : {}),
        ...(input.activityId !== undefined ? { activity_id: input.activityId } : {}),
        ...(input.documentId !== undefined ? { document_id: input.documentId } : {}),
        ...(input.neededFrom !== undefined ? { needed_from: input.neededFrom } : {}),
        ...(input.neededUntil !== undefined ? { needed_until: input.neededUntil } : {}),
        ...(input.mobilizedAt !== undefined ? { mobilized_at: input.mobilizedAt } : {}),
        ...(input.returnedAt !== undefined ? { returned_at: input.returnedAt } : {}),
        ...(input.onHireAt !== undefined ? { on_hire_at: input.onHireAt } : {}),
        ...(input.offHireAt !== undefined ? { off_hire_at: input.offHireAt } : {}),
        ...(input.plantRef !== undefined ? { plant_ref: optionalText(input.plantRef) ?? null } : {}),
        ...(input.dailyRate !== undefined
          ? { daily_rate: input.dailyRate === null ? null : String(input.dailyRate) }
          : {}),
        ...(repriced
          ? { estimated_cost: hireCost(dailyRate, onHire, offHire, current.estimated_cost) }
          : input.estimatedCost !== undefined
            ? { estimated_cost: money(input.estimatedCost) }
            : {}),
        ...(input.actualCost !== undefined ? { actual_cost: money(input.actualCost) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.deliveryLocation !== undefined
          ? { delivery_location: optionalText(input.deliveryLocation) ?? null }
          : {}),
        ...(input.operatorRequired !== undefined
          ? { operator_required: input.operatorRequired ? "Yes" : "No" }
          : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      });
      if (!row) throw new NotFoundError("Equipment request");
      return toEquipmentRequest(row);
    },

    /**
     * Extending a hire is a variation to the hire order, not an edit: the
     * original off-hire date has to survive for the plant reconciliation, so
     * every move is appended to the history with who moved it and why.
     */
    async extendHire(
      projectId: string,
      requestId: string,
      input: ExtendHireInput,
      actorId: string | null,
    ): Promise<EquipmentRequest> {
      const current = await equipmentRow(projectId, requestId);
      if (current.status === "Returned" || current.status === "Cancelled" || current.status === "Rejected") {
        throw new ConflictError(`A ${current.status.toLowerCase()} hire cannot be extended`);
      }
      const from = current.off_hire_at ?? current.needed_until;
      if (new Date(input.offHireAt) <= new Date(from)) {
        throw new BadRequestError("An extension must push the off-hire date later than it is now");
      }

      const extensions = [
        ...parseExtensions(current.extensions),
        {
          at: new Date().toISOString(),
          from,
          to: input.offHireAt,
          reason: optionalText(input.reason) ?? null,
          actorId,
        },
      ];
      const dailyRate = current.daily_rate === null ? null : Number(current.daily_rate);
      const row = await repository.appendHireExtension(requestId, extensions, {
        off_hire_at: input.offHireAt,
        needed_until: input.offHireAt,
        estimated_cost: hireCost(
          dailyRate,
          current.on_hire_at ?? current.needed_from,
          input.offHireAt,
          current.estimated_cost,
        ),
      });
      if (!row) throw new NotFoundError("Equipment request");
      return toEquipmentRequest(row);
    },

    async deleteEquipmentRequest(projectId: string, requestId: string): Promise<void> {
      await equipmentRow(projectId, requestId);
      await repository.deleteEquipmentRequest(requestId);
    },
  };
}

export type EquipmentRequestService = ReturnType<typeof equipmentRequestService>;
