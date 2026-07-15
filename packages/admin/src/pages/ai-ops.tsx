import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { PageHeader, Card } from "@/components/ui";
import { DateRangePicker, AsOf, ChartCard } from "@/components/chart-components";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { formatUsd } from "@/lib/utils";
import { DataTable } from "@/components/data-table";

export default function AiOpsPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const { data, isLoading, error } = useQuery({
    queryKey: adminKeys.metricsAiOps(range),
    queryFn: () => adminApi.metricsAiOps(range),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="AI Operations" 
        description="Token burn, API costs, and job health." 
        actions={
          <div className="flex flex-col items-end gap-1">
            <DateRangePicker value={range} onChange={setRange} />
            {data && <AsOf timestamp={data.asOf} />}
          </div>
        }
      />

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">Total API Cost</span>
            <span className="text-2xl font-bold text-gray-900">{formatUsd(data.platform.totalCostUsd)}</span>
          </Card>
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">Total Tokens Processed</span>
            <span className="text-2xl font-bold text-gray-900">{Intl.NumberFormat('en-US', { notation: "compact" }).format(data.platform.totalTokens)}</span>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Token Burn" 
          isLoading={isLoading} 
          error={error} 
          isEmpty={data?.platform?.series?.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.platform?.series || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
              <YAxis tickFormatter={(v) => Intl.NumberFormat('en-US', { notation: "compact" }).format(v as number)} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => Number(v).toLocaleString()} />
              <Area type="monotone" dataKey="tokensIn" stackId="1" stroke="#004DE7" fill="#004DE7" name="Tokens In" />
              <Area type="monotone" dataKey="tokensOut" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Tokens Out" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard 
          title="Daily Cost (USD)" 
          isLoading={isLoading} 
          error={error} 
          isEmpty={data?.platform?.series?.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.platform?.series || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => formatUsd(Number(v))} />
              <Line type="monotone" dataKey="costUsd" stroke="#10b981" strokeWidth={2} dot={false} name="Cost" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="flex flex-col overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="font-semibold text-gray-900">Cost by Organization</h3>
            </div>
            <DataTable 
              columns={[
                { key: "orgName", header: "Organization", render: (r) => r.orgName },
                { key: "tokens", header: "Tokens", render: (r) => Intl.NumberFormat('en-US', { notation: "compact" }).format(r.tokensIn + r.tokensOut) },
                { key: "cost", header: "Cost", render: (r) => formatUsd(r.costUsd) },
              ]}
              rows={data.costByOrg.map((r, i) => ({ ...r, id: r.orgId || String(i) }))}
            />
          </Card>

          <Card className="flex flex-col overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="font-semibold text-gray-900">Job Health</h3>
            </div>
            <DataTable 
              columns={[
                { key: "jobType", header: "Job Type", render: (r) => r.jobType },
                { key: "total", header: "Total", render: (r) => r.total.toLocaleString() },
                { key: "success", header: "Success Rate", render: (r) => `${r.total > 0 ? ((r.completed / r.total) * 100).toFixed(1) : "0.0"}%` },
                { key: "latency", header: "Avg Latency", render: (r) => `${r.avgLatencySeconds.toFixed(1)}s` },
              ]}
              rows={data.jobHealth.map((r, i) => ({ ...r, id: String(i) }))}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
