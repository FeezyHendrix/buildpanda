import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type HTMLAttributes, type InputHTMLAttributes } from "react";
export type ViewStyle = CSSProperties;
export type ViewProps = HTMLAttributes<HTMLDivElement>;
export type PressableProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: React.MouseEventHandler<HTMLButtonElement>;
    accessibilityLabel?: string;
    accessibilityState?: {
        disabled?: boolean;
        busy?: boolean;
    };
};
export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onChangeText' | 'value' | 'autoCorrect'> & {
    value?: string;
    autoCorrect?: boolean;
    onChangeText?: (value: string) => void;
    editable?: boolean;
    multiline?: boolean;
    secureTextEntry?: boolean;
    keyboardType?: string;
    placeholderTextColor?: string;
    returnKeyType?: string;
    autoCapitalize?: string;
    onSubmitEditing?: () => void;
    textAlignVertical?: string;
};
export type TextInput = HTMLInputElement;
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function Input({ multiline, onChangeText, editable, secureTextEntry, keyboardType, placeholderTextColor, returnKeyType, autoCapitalize, onSubmitEditing, textAlignVertical, autoCorrect, ...props }, ref) {
    const inputMode:InputHTMLAttributes<HTMLInputElement>['inputMode']=props.inputMode??(keyboardType==='decimal-pad'?'decimal':keyboardType==='number-pad'||keyboardType==='numeric'?'numeric':keyboardType==='phone-pad'?'tel':keyboardType==='email-address'?'email':undefined);
    const enterKeyHint=['enter','done','go','next','previous','search','send'].includes(returnKeyType??'')?returnKeyType as InputHTMLAttributes<HTMLInputElement>['enterKeyHint']:undefined;
    const common = { ...props, inputMode,enterKeyHint,autoCapitalize, autoCorrect: autoCorrect === false ? "off" : "on", readOnly: editable === false, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText?.(e.target.value), onKeyDown: (e: React.KeyboardEvent) => {
            if (onSubmitEditing && e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSubmitEditing?.();
            }
        } };
    return multiline ? <textarea {...common as React.TextareaHTMLAttributes<HTMLTextAreaElement>} ref={ref as React.Ref<HTMLTextAreaElement>}/> : <input {...common} type={secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : props.type ?? 'text'} ref={ref}/>;
});
export type NativeScrollEvent = {
    contentOffset: {
        x: number;
        y: number;
    };
};
export type NativeSyntheticEvent<T> = {
    nativeEvent: T;
};
export type ListRenderItemInfo<T> = {
    item: T;
    index: number;
};
type ListHandle = {
    scrollToEnd: (options?: unknown) => void;
    scrollToOffset: (options: {
        offset: number;
        animated?: boolean;
    }) => void;
};
export type FlatList<T = unknown> = ListHandle;
type ListProps<T> = {
    "aria-label"?:string;role?:React.AriaRole;
    data: readonly T[];
    renderItem: (row: ListRenderItemInfo<T>) => ReactNode;
    keyExtractor?: (item: T, index: number) => string;
    getItemLayout?: (data: readonly T[] | null, index: number) => {
        length: number;
        offset: number;
        index: number;
    };
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    ListEmptyComponent?: ReactNode;
    ItemSeparatorComponent?: ComponentType;
    horizontal?: boolean;
    style?: CSSProperties;
    className?: string;
    contentContainerClassName?: string;
    contentContainerStyle?: CSSProperties;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange?: () => void;
    onRefresh?: () => void;
    maintainVisibleContentPosition?: {
        minIndexForVisible: number;
        autoscrollToTopThreshold?: number;
    };
    inverted?: boolean;
    stickySectionHeadersEnabled?: boolean;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    scrollEnabled?: boolean;
    pagingEnabled?: boolean;
    decelerationRate?: string;
    showsHorizontalScrollIndicator?: boolean;
    keyboardShouldPersistTaps?: string;
    keyboardDismissMode?: string;
    initialNumToRender?: number;
    maxToRenderPerBatch?: number;
    windowSize?: number;
    refreshing?: boolean;
    scrollEventThrottle?: number;
    extraData?: unknown;
    removeClippedSubviews?: boolean;
};
// shortcut: content-visibility bounds layout; add windowing if profiling shows DOM creation dominates very large lists.
function List<T>({ data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent, horizontal, style, className, contentContainerClassName, contentContainerStyle, onScroll, onMomentumScrollEnd, onContentSizeChange, onRefresh, "aria-label":ariaLabel,role,pagingEnabled, scrollEnabled = true, inverted, onEndReached, onEndReachedThreshold = 0.25 }: ListProps<T>, ref: React.ForwardedRef<ListHandle>) {
    const el = useRef<HTMLDivElement>(null);
    const content=useRef<HTMLDivElement>(null);
    const sizeChanged=useRef(onContentSizeChange);sizeChanged.current=onContentSizeChange;
    useEffect(()=>{const target=content.current;if(!target)return;const observer=new ResizeObserver(()=>{sizeChanged.current?.();if(inverted&&previous.current.pinned&&el.current)el.current.scrollTop=el.current.scrollHeight;});observer.observe(target);return()=>observer.disconnect();},[inverted]);
    const previous = useRef({ height: 0, top: 0, pinned: true });
    useLayoutEffect(() => { const node = el.current; if (!node || !inverted)
        return; const old = previous.current; node.scrollTop = old.pinned ? node.scrollHeight : old.top + node.scrollHeight - old.height; previous.current = { height: node.scrollHeight, top: node.scrollTop, pinned: old.pinned }; }, [data, inverted]);
    useImperativeHandle(ref, () => ({ scrollToEnd: () => el.current?.scrollTo({ top: el.current.scrollHeight, left: el.current.scrollWidth, behavior: 'smooth' }), scrollToOffset: ({ offset, animated }) => el.current?.scrollTo({ top: horizontal ? 0 : inverted?Math.max(0,(el.current?.scrollHeight??0)-(el.current?.clientHeight??0)-offset):offset, left: horizontal ? offset : 0, behavior: animated ? 'smooth' : 'instant' }) }), [horizontal,inverted]);

    return <div aria-label={ariaLabel} role={role} ref={el} className={"field-stack " + (className)} style={{ scrollSnapType:horizontal&&pagingEnabled?'x mandatory':undefined, overflow: 'auto', flex: 1, minHeight: 0, ...style, overflowY: scrollEnabled ? 'auto' : 'hidden' }} onScroll={e => {
            const event = { nativeEvent: { contentOffset: { x: e.currentTarget.scrollLeft, y: inverted?e.currentTarget.scrollHeight-e.currentTarget.clientHeight-e.currentTarget.scrollTop:e.currentTarget.scrollTop } } };
            const node = e.currentTarget;
            previous.current = { height: node.scrollHeight, top: node.scrollTop, pinned: node.scrollHeight - node.clientHeight - node.scrollTop < 64 };
            const distance = inverted ? node.scrollTop : node.scrollHeight - node.clientHeight - node.scrollTop;
            if (distance < node.clientHeight * onEndReachedThreshold)
                onEndReached?.();
            onScroll?.(event);
            onMomentumScrollEnd?.(event);
        }}><div ref={content} className={"field-stack " + (contentContainerClassName)} style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', ...contentContainerStyle }}>{onRefresh ? <button type="button" onClick={onRefresh} className="min-h-11">Refresh</button> : null}{ListHeaderComponent}{data.length ? (inverted ? [...data].reverse() : data).map((item, index) => <div className="field-stack" key={keyExtractor?.(item, index) ?? index} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 80px', flexShrink: 0,scrollSnapAlign:pagingEnabled?'start':undefined }}>{index > 0 && ItemSeparatorComponent ? <ItemSeparatorComponent /> : null}{renderItem({ item, index })}</div>) : ListEmptyComponent}{ListFooterComponent}</div></div>;
}
export const FlatList = forwardRef<ListHandle, ListProps<unknown>>(List) as <T>(props: ListProps<T> & {
    ref?: React.Ref<ListHandle>;
}) => React.ReactElement;
export function SectionList<T>({sections,renderSectionHeader,renderItem,ListHeaderComponent,ListFooterComponent,ListEmptyComponent,contentContainerClassName,...props}:Omit<ListProps<T>,'data'>&{sections:readonly {title:string;data:readonly T[]}[];renderSectionHeader:(row:{section:{title:string}})=>ReactNode}){
 return <div className={contentContainerClassName} style={{overflow:'auto',minHeight:0,flex:1}}>{ListHeaderComponent}{sections.length?sections.map(section=><section key={section.title}>{renderSectionHeader({section})}<FlatList {...props} data={section.data} renderItem={renderItem}/></section>):ListEmptyComponent}{ListFooterComponent}</div>;
}
export function Modal({ visible, children, onRequestClose }: {
    visible: boolean;
    children: ReactNode;
    onRequestClose?: () => void;
    transparent?: boolean;
    animationType?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (visible)
            ref.current?.showModal();
        else
            ref.current?.close();
    }, [visible]);
    return <dialog ref={ref} onCancel={e => { e.preventDefault(); onRequestClose?.(); }} className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-surface p-0">{visible ? children : null}</dialog>;
}
export const AppState = { get currentState() { return document.visibilityState === 'visible' ? 'active' : 'background'; }, addEventListener(_name: string, listener: (state: string) => void) { const changed = () => listener(AppState.currentState); document.addEventListener('visibilitychange', changed); return { remove: () => document.removeEventListener('visibilitychange', changed) }; } };
export const Alert = { alert(title: string, message?: string, actions?: {
        text?: string;
        style?: string;
        onPress?: () => void;
    }[]) {
        if (!actions) {
            window.alert([title, message].filter(Boolean).join('\n'));
            return;
        }
        const action = actions.find(a => a.style !== 'cancel');
        if (window.confirm([title, message].filter(Boolean).join('\n')))
            action?.onPress?.();
    } };
export const Linking = { openURL: async (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); }, openSettings: async () => { } };
export const Keyboard = { dismiss() { (document.activeElement as HTMLElement)?.blur(); } };
export function useWindowDimensions() { const [size, setSize] = useState({ width: innerWidth, height: innerHeight }); useEffect(() => { const resize = () => setSize({ width: innerWidth, height: innerHeight }); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []); return size; }
