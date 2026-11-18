import { useEffect, useRef, useState, type RefObject } from "react";
import * as pdfjs from "pdfjs-dist";
import { BASE_SCALE, clamp, DEFAULT_ASPECT, MAX_CANVAS_PIXELS } from "./canvas-support";
import type { SheetRenderInfo } from "./markup-types";
// Render the selected revision; cancel pending parsing and painting when its view closes.
export function useSheetPage({ docKey, pdfBase64, imageDataUri, pageNo, canvasRef, onRendered, }: {
    docKey: string;
    pdfBase64: string | null;
    imageDataUri: string | null;
    pageNo: number;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    onRendered: (info: SheetRenderInfo) => Promise<void>;
}) {
    const docCache = useRef<{
        key: string;
        doc: import("pdfjs-dist").PDFDocumentProxy;
    } | null>(null);
    const [aspect, setAspect] = useState(DEFAULT_ASPECT);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => () => {
        docCache.current?.doc.loadingTask.destroy().catch(() => undefined);
        docCache.current = null;
    }, []);
    useEffect(() => {
        if (!pdfBase64 || imageDataUri)
            return;
        let cancelled = false;
        let loadingTask:pdfjs.PDFDocumentLoadingTask|undefined;
        let renderTask:pdfjs.RenderTask|undefined;
        setLoading(true);
        setError(null);
        (async () => {
            let entry = docCache.current;
            if (!entry || entry.key !== docKey) {
                const raw = atob(pdfBase64);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++)
                    bytes[i] = raw.charCodeAt(i);
                loadingTask=pdfjs.getDocument({data:bytes,useSystemFonts:true});
                const doc=await loadingTask.promise;
                if(cancelled){void loadingTask.destroy().catch(()=>{});return;}
                docCache.current?.doc.loadingTask.destroy().catch(() => undefined);
                entry = { key: docKey, doc };
                docCache.current = entry;
            }
            if (cancelled)
                return;
            const safePage = clamp(pageNo, 1, entry.doc.numPages);
            const page = await entry.doc.getPage(safePage);
            if (cancelled)
                return;
            const probe = page.getViewport({ scale: 1 });
            const scale = Math.min(BASE_SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (probe.width * probe.height)));
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            if (!canvas)
                return;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx)
                return;
            renderTask=page.render({canvasContext:ctx,viewport,canvas});
            await renderTask.promise;
            if (cancelled)
                return;
            setAspect(viewport.height / viewport.width);
            setLoading(false);
            void onRendered({ aspect: viewport.height / viewport.width, pageCount: entry.doc.numPages });
        })().catch((err: unknown) => {
            if (cancelled)
                return;
            setLoading(false);
            setError(err instanceof Error ? err.message : "Could not render this sheet");
        });
        return () => {
            cancelled = true;
            renderTask?.cancel();
            if(loadingTask&&docCache.current?.doc.loadingTask!==loadingTask&&!loadingTask.destroyed)void loadingTask.destroy().catch(()=>{});
        };
    }, [docKey, pdfBase64, imageDataUri, pageNo]);
    function imageLoaded(el: HTMLImageElement) {
        if (el.naturalWidth <= 0)
            return;
        const nextAspect = el.naturalHeight / el.naturalWidth;
        setAspect(nextAspect);
        setLoading(false);
        void onRendered({ aspect: nextAspect, pageCount: 1 });
    }
    return { aspect, loading, error, imageLoaded };
}
