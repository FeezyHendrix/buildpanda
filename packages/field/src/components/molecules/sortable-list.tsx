import { useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/atoms/icon';
interface Props<T> {
    data: readonly T[];
    rowHeight: number;
    keyExtractor: (item: T) => string;
    labelExtractor: (item: T) => string;
    onReorder: (items: T[]) => void;
    renderItem: (props: {
        item: T;
        index: number;
        dragging: boolean;
        dragHandle: ReactNode;
    }) => ReactNode;
    header?: ReactNode;
    footer?: ReactNode;
    disabled?: boolean;
}
export function SortableList<T>({ data, rowHeight, keyExtractor, labelExtractor, onReorder, renderItem, header, footer, disabled = false }: Props<T>) {
    const [active, setActive] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const drag = useRef<{
        key: string;
        start: number;
        from: number;
        scrollTop: number;
        keys: string;
    } | null>(null);
    const viewport = useRef<HTMLDivElement>(null);
    function move(from: number, to: number) {
        if (disabled || from === to || to < 0 || to >= data.length)
            return;
        const result = [...data];
        const [item] = result.splice(from, 1);
        result.splice(to, 0, item!);
        onReorder(result);
        setAnnouncement(`${labelExtractor(item!)} moved to position ${to + 1} of ${data.length}`);
    }
    return <div ref={viewport} className="field-stack min-h-0 flex-1 overflow-auto pb-6">{header}<span role="status" className="sr-only">{announcement}</span>{data.map((item, index) => {
            const key = keyExtractor(item);
            const label = labelExtractor(item);
            return <div key={key} className={"field-stack " + (active === key ? 'border border-primary-500 bg-primary-50' : 'border-b border-hairline bg-surface')} style={{ minHeight: rowHeight }}>{renderItem({ item, index, dragging: active === key, dragHandle: <button type="button" disabled={disabled} aria-label={`Reorder ${label}`} aria-description="Drag up or down, or use the arrow keys to move this item." className="h-12 w-12 touch-none rounded-lg" onKeyDown={event => {
                            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                event.preventDefault();
                                move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
                            }
                        }} onPointerDown={event => {
                            if (disabled)
                                return;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            drag.current = { key, start: event.clientY, from: index, scrollTop: viewport.current?.scrollTop ?? 0, keys: data.map(keyExtractor).join('|') };
                            setActive(key);
                        }} onPointerMove={event => {
                            if (!drag.current || disabled || !viewport.current)
                                return;
                            const bounds = viewport.current.getBoundingClientRect();
                            if (event.clientY < bounds.top + 48)
                                viewport.current.scrollTop -= 12;
                            if (event.clientY > bounds.bottom - 48)
                                viewport.current.scrollTop += 12;
                        }} onPointerUp={event => {
                            const current = drag.current;
                            drag.current = null;
                            setActive(null);
                            if (!current || disabled || current.keys !== data.map(keyExtractor).join('|'))
                                return;
                            const offset = event.clientY - current.start + (viewport.current?.scrollTop ?? 0) - current.scrollTop;
                            move(current.from, Math.max(0, Math.min(data.length - 1, current.from + Math.round(offset / rowHeight))));
                        }} onPointerCancel={() => { drag.current = null; setActive(null); }}><Icon name="reorder-three-outline" size={26}/></button> })}</div>;
        })}{footer}</div>;
}
