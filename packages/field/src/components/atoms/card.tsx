import { type ViewProps } from "@/platform/browser";
import { cn } from "@/lib/utils";
interface CardProps extends ViewProps {
    className?: string;
}
export function Card({ className, ...props }: CardProps) {
    return (<div className={"field-stack " + (cn("rounded-xl border border-line bg-surface overflow-hidden", className))} {...props}/>);
}
Card.displayName = "Card";
export type { CardProps };
