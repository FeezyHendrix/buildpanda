import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { PageHeader } from "@/components/ui";
import { DateRangePicker, AsOf, ChartCard } from "@/components/chart-components";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LabelList } from "recharts";

import { PageContainer } from "@/components/page-container";

export default function GrowthPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  const { data, isLoading, error } = useQuery({
    queryKey: adminKeys.metricsGrowth(range),
    queryFn: () => adminApi.metricsGrowth(range),
  });

  return (
    <PageContainer variant="wide" className="flex flex-col gap-6">
      <PageHeader 
        title="Growth" 
        description="Signups and activation funnel." 
        actions={
          <div className="flex flex-col items-end gap-1">
            <DateRangePicker value={range} onChange={setRange} />
            {data && <AsOf timestamp={data.asOf} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Signups over time" 
          isLoading={isLoading} 
          error={error} 
          isEmpty={data?.signupSeries?.length === 0}
        >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.signupSeries || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#004DE7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#004DE7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="day" tickFormatter={(v) => new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dx={-10} />
            <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
            <Area type="monotone" dataKey="value" stroke="#004DE7" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard 
        title="Activation funnel" 
        subtitle="Conversion rate at each onboarding step"
        isLoading={isLoading} 
        error={error} 
        isEmpty={data?.funnel?.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.funnel || []} layout="vertical" margin={{ top: 10, right: 50, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
            <XAxis type="number" hide />
            <YAxis dataKey="step" type="category" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={150} />
            <Tooltip
              cursor={{ fill: "transparent" }}
              formatter={(value, _name, props) => {
                const pct = (props.payload as { conversionPct?: number }).conversionPct ?? 100;
                return [`${Number(value).toLocaleString()} (${pct.toFixed(1)}% of prev)`, "Users"];
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={40}>
              {(data?.funnel || []).map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? "#004DE7" : index === 1 ? "#3b82f6" : "#93c5fd"} />
              ))}
              <LabelList dataKey="value" position="right" fill="#6b7280" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </ChartCard>
      </div>
    </PageContainer>
  );
}
