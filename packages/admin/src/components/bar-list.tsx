import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export const pct = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "—");

export function Section({ title, hint, className, children }: { title: string; hint: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", className)}>
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

export function BarList({ rows, total }: { rows: { label: string; value: number; note?: string }[]; total: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="whitespace-nowrap text-muted">
              {r.note ? `${r.note} · ` : ""}
              <span className="font-semibold text-ink">{r.value.toLocaleString()}</span> · {pct(r.value, total)}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: total > 0 ? `${(r.value / total) * 100}%` : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
