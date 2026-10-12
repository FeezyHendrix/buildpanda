import { cn } from "@/lib/cn";

type PanelCaptionProps = {
  label: string;
  title: string;
  description: string;
  className?: string;
};

/** The label, title and description under a panel. */
export function PanelCaption({ label, title, description, className }: PanelCaptionProps) {
  return (
    <div className={cn("mt-5", className)}>
      <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-brand uppercase">{label}</p>
      <h3 className="mt-2 text-[1.0625rem] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[0.9375rem] leading-normal text-pretty text-ink-soft">{description}</p>
    </div>
  );
}
