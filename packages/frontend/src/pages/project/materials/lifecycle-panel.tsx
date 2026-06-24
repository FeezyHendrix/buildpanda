import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import type { MaterialOrder } from "@/lib/project-types";
import { Link } from "react-router-dom";
import { IconBox } from "@/components/atoms/icon-box";

import { STATUS_META, formatDate } from "./shared";

export function LifecyclePanel({ projectId, orders }: { projectId: string; orders: MaterialOrder[] }) {
  const awaiting = orders.filter((order) => ["Requested", "Approved", "Ordered", "PartiallyDelivered"].includes(order.status));
  return (
    <aside className="flex flex-col gap-4">
      <Card padding="lg" className="bg-[#0F172A] text-white">
        <div className="flex items-start gap-3">
          <IconBox tone="brand" size="sm" icon={<CalendarIcon className="size-4" />} />
          <div>
            <h2 className="text-base font-semibold">Construction lifecycle links</h2>
            <p className="mt-2 text-sm text-white/70 text-pretty">
              Material requests are not standalone: they unblock schedule activities, create finance receipts when delivered, and point back to supporting specs or receipts.
            </p>
          </div>
        </div>
      </Card>
      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900">Next procurement actions</h2>
        <ul className="mt-3 flex flex-col divide-y divide-[#F0F0F0]">
          {awaiting.slice(0, 5).map((order) => (
            <li key={order.id} className="py-3">
              <p className="text-sm font-medium text-gray-900">{order.materialName}</p>
              <p className="mt-1 text-xs text-gray-500">{STATUS_META[order.status].label} · needed {formatDate(order.neededBy)}</p>
            </li>
          ))}
          {awaiting.length === 0 && <li className="py-3 text-sm text-gray-500">No material blockers right now.</li>}
        </ul>
      </Card>
      <Card padding="lg">
        <h2 className="text-sm font-semibold text-gray-900">Connected workspaces</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/activities`}>Site activities</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/finances`}>Finance receipts</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/documents`}>Specifications & receipts</Link>
          <Link className="font-semibold text-[#004DE7] hover:underline" to={`/project/${projectId}/daily-log`}>Daily delivery log</Link>
        </div>
      </Card>
    </aside>
  );
}


