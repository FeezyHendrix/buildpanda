import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn("rounded-2xl border border-grey-50 bg-white overflow-hidden", className)}
      {...props}
    />
  );
}

Card.displayName = "Card";

export type { CardProps };
