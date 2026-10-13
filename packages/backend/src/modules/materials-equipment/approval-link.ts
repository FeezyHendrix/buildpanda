import { sameMaterial } from "../materials-ledger/units.ts";
import type { MaterialApprovalRef } from "./types.ts";

export interface LinkedApproval {
  id: string;
  title: string;
  status: string;
}

/**
 * The material approvals of one project, read the way an order needs them.
 * A resubmission replaces the request it came from, so every link resolves
 * to the newest request in its chain: an order placed against a rejected
 * sample follows the resubmitted one and is unblocked when that is approved.
 */
export function approvalIndex(approvals: MaterialApprovalRef[]) {
  const byId = new Map(approvals.map((a) => [a.id, a]));
  const successor = new Map<string, string>();
  for (const approval of approvals) {
    if (approval.resubmitted_from_id) successor.set(approval.resubmitted_from_id, approval.id);
  }

  function head(id: string): MaterialApprovalRef | null {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && successor.has(current.id) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(successor.get(current.id)!);
    }
    return current ?? null;
  }

  // Newest first (the repository orders by created_at desc), superseded ones out.
  const current = approvals.filter((a) => !successor.has(a.id));

  return {
    /** The approval an order relies on: its own link, else one for the same material. */
    forOrder(order: { approval_id: string | null; material_name: string }): LinkedApproval | null {
      const linked = order.approval_id ? head(order.approval_id) : null;
      const found = linked ?? current.find((a) => sameMaterial(a.material_name, order.material_name)) ?? null;
      return found ? { id: found.id, title: found.title, status: found.status } : null;
    },
    /** For a new order: the current request for this material, if there is one. */
    forMaterial(materialName: string): LinkedApproval | null {
      const found = current.find((a) => sameMaterial(a.material_name, materialName));
      return found ? { id: found.id, title: found.title, status: found.status } : null;
    },
    has(id: string): boolean {
      return byId.has(id);
    },
  };
}

export type ApprovalIndex = ReturnType<typeof approvalIndex>;
