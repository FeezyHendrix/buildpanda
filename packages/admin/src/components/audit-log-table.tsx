import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, AdminAuditLogRow } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { DataTable } from "./data-table";
import { Badge } from "./ui";

export function AuditLogTable({ targetId, adminUserId }: { targetId?: string; adminUserId?: string }) {
  const [page, setPage] = useState(0);
  const limit = 10;
  
  const { data, isLoading } = useQuery({
    queryKey: adminKeys.auditLog({ targetId, adminUserId, limit, offset: page * limit }),
    queryFn: () => adminApi.auditLog({ targetId, adminUserId, limit, offset: page * limit }),
  });

  return (
    <div className="flex flex-col">
      <DataTable
        columns={[
          { key: "time", header: "Time", render: (r: AdminAuditLogRow) => new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
          { key: "action", header: "Action", render: (r: AdminAuditLogRow) => (
            <div className="flex items-center gap-2">
              <Badge tone={r.method === "DELETE" ? "danger" : r.method === "POST" ? "brand" : "neutral"}>
                {r.method}
              </Badge>
              <span>{r.action}</span>
            </div>
          ) },
          { key: "admin", header: "Admin", render: (r: AdminAuditLogRow) => (
            <div className="flex flex-col">
              <span className="text-xs font-medium">{r.adminName}</span>
              <span className="text-xs text-gray-500">{r.adminEmail}</span>
            </div>
          ) },
          { key: "target", header: "Target", render: (r: AdminAuditLogRow) => <span className="text-xs text-gray-500">{r.targetType} {r.targetId}</span> },
        ]}
        rows={data?.rows || []}
      />
      {/* Basic pagination controls */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <button 
          onClick={() => setPage(p => Math.max(0, p - 1))} 
          disabled={page === 0 || isLoading}
          className="text-sm text-gray-600 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {page + 1}</span>
        <button 
          onClick={() => setPage(p => p + 1)} 
          disabled={!data || data.rows.length < limit || isLoading}
          className="text-sm text-gray-600 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
