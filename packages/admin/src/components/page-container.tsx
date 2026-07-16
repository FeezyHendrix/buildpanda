import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "wide";
}

export function PageContainer({ variant = "default", className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full",
        variant === "default" ? "mx-auto max-w-7xl" : "max-w-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
