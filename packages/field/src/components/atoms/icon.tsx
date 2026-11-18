import glyphs from './ionicons.json';
import type { CSSProperties } from 'react';
export default function Icon({ name, size = 20, color, style }: {
    name: keyof typeof glyphs;
    size?: number;
    color?: string;
    style?: CSSProperties;
}) { return <span aria-hidden="true" style={{ fontFamily: 'Ionicons', fontSize: size, color, lineHeight: 1, ...style }}>{String.fromCodePoint(glyphs[name] ?? glyphs['help-circle-outline'])}</span>; }
Icon.glyphMap = glyphs;
