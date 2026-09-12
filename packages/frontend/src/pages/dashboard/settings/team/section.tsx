import React from "react";

export interface SectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4 divide-y divide-line-hair overflow-hidden rounded-lg border border-line-hair">
        {children}
      </div>
    </section>
  );
}

export function RowMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-ink-muted">{children}</p>;
}
