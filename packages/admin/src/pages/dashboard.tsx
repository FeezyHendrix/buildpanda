import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { Card, Loading, ErrorState, PageHeader, StatusBadge, RoleBadge, Badge } from "@/components/ui";
import { formatDate, formatMoney, formatUsd, cn } from "@/lib/utils";
import { DateRangePicker, AsOf } from "@/components/chart-components";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export default function DashboardPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const overviewQuery = useQuery({
    queryKey: adminKeys.overview(),
    queryFn: adminApi.overview,
  });

  const metricsQuery = useQuery({
    queryKey: adminKeys.metricsOverview(range),
    queryFn: () => adminApi.metricsOverview(range),
  });

  if (overviewQuery.isLoading || metricsQuery.isLoading) return <Loading />;
  if (overviewQuery.isError || !overviewQuery.data || metricsQuery.isError || !metricsQuery.data) return <ErrorState />;

  const { data } = overviewQuery;
  const metrics = metricsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Dashboard" 
        description="Platform-wide overview of BuildPanda." 
        actions={
          <div className="flex flex-col items-end gap-1">
            <DateRangePicker value={range} onChange={setRange} />
            <AsOf timestamp={metrics.asOf} />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Signups */}
        <Card className="flex flex-col p-4 relative overflow-hidden">
          <span className="text-sm text-gray-500">Signups</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{metrics.signups.value.toLocaleString()}</span>
            {metrics.signups.deltaPct !== 0 && (
              <span className={cn("text-xs font-medium", metrics.signups.deltaPct > 0 ? "text-emerald-600" : "text-rose-600")}>
                {metrics.signups.deltaPct > 0 ? "+" : ""}{metrics.signups.deltaPct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-auto pt-2">
            <div className="h-10 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.signups.series}>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Line type="monotone" dataKey="value" stroke="#004DE7" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Active Users */}
        <Card className="flex flex-col p-4">
          <span className="text-sm text-gray-500">Active users (WAU)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{metrics.activeUsers.wau.toLocaleString()}</span>
          </div>
          <div className="mt-auto pt-2 text-xs text-gray-500">
            <span className="font-medium text-gray-900">{metrics.activeUsers.stickiness.toFixed(0)}%</span> stickiness (DAU/MAU)
          </div>
        </Card>

        {/* AI Spend */}
        <Card className="flex flex-col p-4">
          <span className="text-sm text-gray-500">AI spend</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{formatUsd(metrics.aiSpend.costUsd)}</span>
          </div>
          <div className="mt-auto pt-2 text-xs text-gray-500">
            <span className="font-medium text-gray-900">{Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(metrics.aiSpend.tokens)}</span> tokens
          </div>
        </Card>

        {/* AI Jobs */}
        <Card className="flex flex-col p-4">
          <span className="text-sm text-gray-500">AI jobs</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{metrics.aiJobs.total.toLocaleString()}</span>
          </div>
          <div className="mt-auto pt-2 text-xs text-gray-500">
            <span className="font-medium text-emerald-600">{metrics.aiJobs.successRate.toFixed(1)}%</span> success rate
          </div>
        </Card>

        {/* Value Tracked */}
        <Card className="flex flex-col p-4">
          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Total value tracked</span>
            <Badge tone="neutral"><span className="text-[10px]">Logged, not revenue</span></Badge>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{formatMoney(metrics.valueTracked.totalBudgetTracked)}</span>
          </div>
          <div className="mt-auto pt-2 text-xs text-gray-500 truncate">
            Top: {metrics.valueTracked.highestBudgetedProject ? (
              <Link to={`/projects/${metrics.valueTracked.highestBudgetedProject.id}`} className="font-medium text-primary-600 hover:underline">
                {metrics.valueTracked.highestBudgetedProject.name}
              </Link>
            ) : "None"}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Newest users</h2>
          <ul className="flex flex-col divide-y divide-line">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/users/${u.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink hover:text-brand">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </Link>
                <RoleBadge role={u.role} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Newest projects</h2>
          <ul className="flex flex-col divide-y divide-line">
            {data.recentProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/projects/${p.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink hover:text-brand">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {p.ownerName ?? "—"}
                    {p.organizationName ? ` · ${p.organizationName}` : ""} · {formatDate(p.created_at)}
                  </p>
                </Link>
                <StatusBadge value={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
