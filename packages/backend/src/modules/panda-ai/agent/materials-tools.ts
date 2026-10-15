import { agentRepository } from "./repository.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";
import { shapeLedger } from "./material-ledger.ts";

export function materialsTools(): AgentTool[] {
  return [
    tool(fn("get_materials", "Get planned material orders and requests (what was ordered) with status, supplier, cost, the material approval each order was placed against (title and status, null when none), and the deliveries received against each one (quantity, date, delivery-note number, and whether a load was rejected). This is the procurement list, NOT current stock on hand — for how much of a material is currently available, use get_material_stock. For which orders are running late, use get_late_material_orders."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const materials = await repo.materials(ctx.projectId);
      const deliveries = await repo.deliveriesForOrders(materials.map((m) => m.id));
      const byOrder = new Map<string, typeof deliveries>();
      for (const d of deliveries) {
        const bucket = byOrder.get(d.order_id);
        if (bucket) bucket.push(d);
        else byOrder.set(d.order_id, [d]);
      }
      return { output: materials.map((m) => ({
        material: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
        supplier: m.supplier,
        status: m.status,
        neededBy: m.needed_by,
        estimatedCost: m.estimated_cost,
        approval: m.approval_title ? { title: m.approval_title, status: m.approval_status } : null,
        deliveries: (byOrder.get(m.id) ?? []).map((d) => ({
          quantity: d.delivered_qty,
          deliveredAt: d.delivered_at,
          deliveryNote: d.delivery_note,
          rejected: d.rejected,
          rejectedReason: d.rejected_reason,
        })),
      })) };
    }),

    tool(fn("get_late_material_orders", "Get the material orders that are actually LATE right now: their needed-by date has passed and they have not been delivered, or the supplier's expected delivery date is after the date the material was needed. Cancelled and rejected orders are excluded. Use this for 'which material orders are late', 'what deliveries are overdue', or 'which suppliers do I need to chase' — do NOT infer lateness from get_materials yourself."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const today = new Date().toISOString().slice(0, 10);
      const orders = await repo.lateMaterials(ctx.projectId, today);
      return { output: {
        today,
        lateOrders: orders.map((m) => ({
          material: m.material_name,
          quantity: m.quantity,
          unit: m.unit,
          supplier: m.supplier,
          status: m.status,
          neededBy: m.needed_by,
          expectedDeliveryAt: m.expected_delivery_at,
          daysLate: m.needed_by < today
            ? Math.floor((Date.parse(today) - Date.parse(m.needed_by)) / 86400000)
            : 0,
          reason: m.needed_by < today ? "past its needed-by date" : "supplier promised it after it is needed",
          estimatedCost: m.estimated_cost,
        })),
      } };
    }),

    tool(fn("get_material_stock", "Get the live on-hand stock for each material from the materials ledger, with the received and used totals behind it — the same figures the Material log page shows. Voided entries and entries still awaiting approval are EXCLUDED from received/used and from on-hand, so received minus used equals on hand; voidedReceived/voidedUsed report separately how much was logged and then voided. Use this for any question about how much of a material is currently available, in stock, remaining, received, or running low. For the individual movements, the voids and who voided them, use get_material_ledger."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const stock = await repo.materialStock(ctx.projectId);
      return {
        output: {
          materials: stock.map((s) => ({
            material: s.material_name,
            unit: s.unit,
            location: s.location_key,
            onHand: Number(s.on_hand_qty),
            totalReceived: Number(s.total_received ?? 0),
            totalUsed: Number(s.total_used ?? 0),
            voidedEntryCount: Number(s.voided_entry_count ?? 0),
            voidedReceived: Number(s.voided_received ?? 0),
            voidedUsed: Number(s.voided_used ?? 0),
            lowStockThreshold: s.low_stock_threshold === null ? null : Number(s.low_stock_threshold),
            lowStock: s.low_stock_threshold !== null && Number(s.on_hand_qty) <= Number(s.low_stock_threshold),
          })),
          // Only when there is stock to explain: an unconditional note would
          // make an empty result look like data to the grounding gate.
          ...(stock.length > 0
            ? {
                note: "totalReceived and totalUsed exclude voided and not-yet-approved entries, so onHand = totalReceived - totalUsed. A non-zero voidedEntryCount means movements were logged and then voided; say so and use get_material_ledger for the reason and who voided them.",
              }
            : {}),
        },
      };
    }),

    tool(fn("get_material_ledger", "Get the material log itself — every stock movement on the project newest first: receipts (IN), issues to site (USED) and VOIDS, each with its quantity, unit, location, supplier, delivery-note number, who logged it, its approval state and any flags. A VOIDED entry is still on the ledger: it comes back with voided=true, the void reason, who voided it and when, and countsTowardStock=false, and the VOID entry that reversed it appears as its own row. Use this for 'what was voided and why', 'who voided that delivery', 'what has been received or used recently', 'what is awaiting approval', or to explain a stock figure movement by movement. Never treat a voided entry as if it had not happened — report it as a void with its reason; never count it toward stock.", {
      limit: { type: "integer", minimum: 1, maximum: 200, description: "How many recent entries (default 50)." },
    }), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const limit = typeof args.limit === "number"
        ? Math.max(1, Math.min(200, Math.trunc(args.limit)))
        : 50;
      const rows = await repo.materialLedgerEntries(ctx.projectId, limit);
      const voidedIds = rows.filter((r) => r.status === "Voided").map((r) => r.id);
      const reversals = await repo.materialLedgerReversalsFor(voidedIds);
      return { output: shapeLedger(rows, reversals) };
    }),

    tool(fn("get_suppliers", "Get the project's supplier directory (name, contact person, email, phone, address). Use for questions about who supplies materials, supplier contact details, or which vendors are on file."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const suppliers = await repo.suppliers(ctx.projectId);
      return {
        output: suppliers.map((s) => ({
          name: s.name,
          contactName: s.contact_name,
          email: s.email,
          phone: s.phone,
          address: s.address,
        })),
      };
    }),
  ];
}
