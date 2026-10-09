import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
      {...props}
    />
  );
}

Card.displayName = "Card";

export type { CardProps };
