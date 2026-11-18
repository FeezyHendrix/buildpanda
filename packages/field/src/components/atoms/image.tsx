import type { CSSProperties } from 'react';
export function Image({ source, contentFit = 'cover', accessibilityLabel, style, ...props }: {
    source: string | {
        uri: string;
    };
    contentFit?: 'cover' | 'contain';
    accessibilityLabel?: string;
    style?: CSSProperties;
    className?: string;
    onError?: () => void;
    transition?: number;
}) { const { transition, ...rest } = props; return <img {...rest} alt={accessibilityLabel ?? ''} src={typeof source === 'string' ? source : source.uri} style={{ objectFit: contentFit, ...style }}/>; }
