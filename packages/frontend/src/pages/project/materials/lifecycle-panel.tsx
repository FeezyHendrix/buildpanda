import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { MaterialOrder } from "@/lib/project-types";
import { formatShortDate } from "@/lib/formatters";



const WORKSPACES: { label: string; to: (projectId: string) => string }[] = [
  { label: "Site activities", to: (projectId) => `/project/${projectId}/activities` },
  { label: "Finance receipts", to: (projectId) => `/project/${projectId}/finances` },
  { label: "Specifications & receipts", to: (projectId) => `/project/${projectId}/documents` },
  { label: "Daily delivery log", to: (projectId) => `/project/${projectId}/daily-log` },
];

export function LifecyclePanel({ projectId, orders }: { projectId: string; orders: MaterialOrder[] }) {
  const awaiting = orders.filter((order) =>
    ["Requested", "Approved", "Ordered", "PartiallyDelivered"].includes(order.status),
  );
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <div className="border border-[#EBEBEB] bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-sm font-bold leading-none text-white">
            !
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#1E1E1E]">Construction Lifecycle Links</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#767676]">
              Material requests are not standalone: they unblock schedule
              activities, create finance receipts when delivered, and point back
              to supporting specs or receipts.
            </p>
          </div>
        </div>
      </div>

      <div className="border border-[#EBEBEB] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1E1E1E]">Next Procurement Actions</h2>
        {awaiting.length === 0 ? (
          <p className="mt-2 text-xs text-[#767676]">No material blockers right now.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-[#F0F0F0]">
            {awaiting.slice(0, 5).map((order) => (
              <li key={order.id} className="py-2.5 first:pt-1 last:pb-0">
                <p className="text-[13px] font-medium text-[#1E1E1E]">
                  {order.quantity} {order.unit} · {order.materialName}
                </p>
                {order.neededBy && (
                  <p className="mt-1 text-xs font-medium text-[#004DE7]">
                    Needed {formatShortDate(order.neededBy)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#1E1E1E]">Connected Workspaces</h2>
        {WORKSPACES.map((item) => (
          <Link
            key={item.label}
            to={item.to(projectId)}
            className="flex items-center justify-between border border-[#EBEBEB] bg-white px-4 py-3 outline-none transition-colors hover:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <span className="text-[13px] font-medium text-[#1E1E1E]">{item.label}</span>
            <ArrowUpRight className="size-4 shrink-0 text-[#004DE7]" />
          </Link>
        ))}
      </div>
    </aside>
  );
}
