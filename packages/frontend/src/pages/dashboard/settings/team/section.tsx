import { cn } from "@/lib/utils";
import React from "react";

export interface SectionProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between border-x-[0.5px] border-t-[0.5px] border-border px-6 py-4">
        {title && <h6 className="text-h6 font-semibold text-black">{title}</h6>}
        {action}
      </div>
      <div className={cn("divide-y divide-[#F6F6F6] overflow-hidden px-6 py-4 border border-[#F0F0F0]", className)}>
        {children}
      </div>
    </section>
  );
}

export function RowMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-gray-400">{children}</p>;
}
