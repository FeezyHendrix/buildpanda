import { type ReactNode } from "react";

export function FormSection({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return (
    <div className="border border-[#EBEBEB]">
      <div className="border-b border-[#EBEBEB] bg-[#F8F8F8] px-8 py-3.5">
        <h3 className="text-body-s font-semibold text-[#1E1E1E]">{title}</h3>
        {description && <p className="text-caption-l text-grey-450">{description}</p>}
      </div>
      <div className="space-y-5 px-8 py-6">{children}</div>
    </div>
  );
}