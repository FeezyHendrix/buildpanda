import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { PageHeader, Card } from "@/components/ui";
import { DateRangePicker, AsOf, ChartCard } from "@/components/chart-components";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function EngagementPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const { data, isLoading, error } = useQuery({
    queryKey: adminKeys.metricsEngagement(range),
    queryFn: () => adminApi.metricsEngagement(range),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Engagement" 
        description="Active users and stickiness metrics." 
        actions={
          <div className="flex flex-col items-end gap-1">
            <DateRangePicker value={range} onChange={setRange} />
            {data && <AsOf timestamp={data.asOf} />}
          </div>
        }
      />

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">DAU</span>
            <span className="text-2xl font-bold text-gray-900">{data.dau.toLocaleString()}</span>
          </Card>
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">WAU</span>
            <span className="text-2xl font-bold text-gray-900">{data.wau.toLocaleString()}</span>
          </Card>
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">MAU</span>
            <span className="text-2xl font-bold text-gray-900">{data.mau.toLocaleString()}</span>
          </Card>
          <Card className="p-5 flex flex-col gap-1">
            <span className="text-sm text-gray-500">Stickiness (DAU/MAU)</span>
            <span className="text-2xl font-bold text-emerald-600">{data.stickiness.toFixed(1)}%</span>
          </Card>
        </div>
      )}

      <ChartCard 
        title="Active users over time" 
        isLoading={isLoading} 
        error={error} 
        isEmpty={data?.activeSeries?.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.activeSeries || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dx={-10} />
            <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
            <Line type="monotone" dataKey="value" stroke="#004DE7" strokeWidth={2} dot={{ r: 2, fill: "#004DE7" }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
