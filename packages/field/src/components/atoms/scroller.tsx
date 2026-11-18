import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
export const Scroller = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
    bounces?: boolean;
    contentContainerClassName?: string;
    contentContainerStyle?: CSSProperties;
    horizontal?: boolean;
    keyboardShouldPersistTaps?: string;
    keyboardDismissMode?: string;
    scrollEventThrottle?: number;
    showsHorizontalScrollIndicator?: boolean;
}>(function Scroller({ children, contentContainerStyle, contentContainerClassName, horizontal, keyboardShouldPersistTaps, keyboardDismissMode, scrollEventThrottle, showsHorizontalScrollIndicator, bounces, ...props }, ref) { return <div className="field-stack" {...props} ref={ref} style={{ overflow: 'auto', minHeight: 0, ...props.style }}><div className={"field-stack " + (contentContainerClassName)} style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', ...contentContainerStyle }}>{children}</div></div>; });
