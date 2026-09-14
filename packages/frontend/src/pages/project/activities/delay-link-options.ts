import type { DelayLinkOptions } from "@/components/molecules/delay-link-fields";
import type { ChangeRequest, MaterialOrder, Rfi } from "@/lib/project-types";

const MAX_PER_LIST = 100;

/**
 * The records a delay can cite as its cause, labelled the way a PM refers to
 * them ("RFI-2 · Culvert 1 invert level"). Kept out of the page so the page
 * stays a composition root.
 */
export function buildDelayLinkOptions(
  rfis: Rfi[],
  changeRequests: ChangeRequest[],
  materialOrders: MaterialOrder[],
): DelayLinkOptions {
  return {
    rfis: rfis.slice(0, MAX_PER_LIST).map((rfi) => ({
      id: rfi.id,
      label: `RFI-${rfi.number} · ${rfi.subject}`,
    })),
    changeRequests: changeRequests.slice(0, MAX_PER_LIST).map((cr) => ({
      id: cr.id,
      label: cr.title,
    })),
    materialOrders: materialOrders.slice(0, MAX_PER_LIST).map((order) => ({
      id: order.id,
      label: `${order.title} · ${order.materialName}`,
    })),
  };
}
