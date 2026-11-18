import { CachedDocumentImage } from '@/components/molecules/cached-document-image';
import { requireCurrentAccess } from "@/lib/project-access-store";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useLocalSearchParams } from "@/navigation";
import { useEffect, useState } from "react";
import { Image } from "@/components/atoms/image";
import { readCachedFileBase64 } from "@/lib/download-file";
import { Button, Spinner, Text } from "@/components/atoms";
import { DocumentPreview } from "@/components/molecules/document-preview";
import { Page } from "@/components/molecules/page";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import { SHEET_TOOL } from "@/components/plan-review/markup-types";
import { SheetPager } from "@/components/plan-review/sheet-controls";
import { requireCachedFile, verifyCachedFile } from "@/lib/download-file";
import { useSyncState } from "@/lib/sync-provider";
import { palette } from "@/constants/colors";
import { goBack } from "@/lib/navigation";
const ignore = async () => { };
/** Uses the plan renderer for PDFs, including offline files on Android. */
function PdfViewer({ uri }: {
    uri: string;
}) {
    const [bytes, setBytes] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [pageNo, setPageNo] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    useEffect(() => {
        let cancelled = false;
        setBytes(null);
        setError(null);
        const ticket = requireCachedFile(uri);
        readCachedFileBase64(uri).then((value) => {
            requireCurrentAccess(ticket);
            if (!cancelled)
                setBytes(value);
        }).catch(() => {
            if (!cancelled)
                setError("This saved file could not be opened. Download it again when you have signal.");
        });
        return () => { cancelled = true; };
    }, [uri, attempt]);
    if (error)
        return <div className="field-stack gap-4 py-8"><Text tone="danger">{error}</Text><Button onPress={() => setAttempt((value) => value + 1)}>Try again</Button></div>;
    if (!bytes)
        return <div className="field-stack flex-1 items-center justify-center"><Spinner /></div>;
    return (<div className="field-stack relative flex-1 overflow-hidden rounded-xl">
      <SheetCanvas docKey={uri} pdfBase64={bytes} imageDataUri={null} pageNo={pageNo} markups={[]} selectedId={null} tool={SHEET_TOOL.PAN} color={palette.primary500} metresPerPct={null} fitNonce={0} draftPin={null} onCreate={ignore} onTapPoint={ignore} onSelect={ignore} onZoom={ignore} onRendered={async (info) => setPageCount(info.pageCount)}/>
      <SheetPager pageNo={pageNo} pageCount={pageCount} onChangePage={setPageNo}/>
    </div>);
}
function DocumentViewer() {
    const { uri, name } = useLocalSearchParams<{
        uri: string;
        name?: string;
    }>();
    const [webError, setWebError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [verifiedUri, setVerifiedUri] = useState<string | null>(null);
    const { isOnline } = useSyncState();
    useEffect(() => {
        let active = true;
        setVerifiedUri(null);
        if (uri)
            void verifyCachedFile(uri).then(() => {
                if (active)
                    setVerifiedUri(uri);
            }).catch(() => undefined);
        return () => { active = false; };
    }, [uri, isOnline]);
    const isPdf = /\.pdf(?:$|[?#])/i.test(name || uri || "");
    const isImage = /\.(png|jpe?g|gif|webp|heic|bmp)(?:$|[?#])/i.test(name || uri || "");
    let available = false;
    try {
        if (uri && verifiedUri === uri && (!uri.includes("/messages/") || isOnline)) {
            requireCachedFile(uri);
            available = true;
        }
    }
    catch { /* Invalid deep links never open local files. */ }
    return (<Page title={name || "Document"} onBack={goBack} scroll={false} showSync={false}>
      {!available ? (<div className="field-stack items-center py-12"><Text tone="secondary">This file isn&apos;t available offline yet.</Text></div>) : isPdf ? <PdfViewer key={uri} uri={uri}/> : webError ? (<div className="field-stack gap-4 py-8">
          <Text tone="danger">This file could not be previewed on this device.</Text>
          <Button onPress={() => { setWebError(false); setAttempt((value) => value + 1); }}>Try again</Button>
        </div>) : isImage ? (<CachedDocumentImage key={`${uri}:${attempt}`} uri={uri} onError={() => setWebError(true)}/>) : (<DocumentPreview uri={uri} attempt={attempt} onError={() => setWebError(true)}/>)}
    </Page>);
}
export default withProjectPermission(DocumentViewer, "/tools/documents/view");
