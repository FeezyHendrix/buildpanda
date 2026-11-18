import { useEffect, useState, useRef } from "react";
import { Image } from "@/components/atoms/image";
import { NativeScrollEvent, NativeSyntheticEvent, FlatList } from "@/platform/browser";
import { Button, Spinner, Text } from "@/components/atoms";
import { ImageModal } from "@/components/rich-text/rich-content";
import { useContentImage } from "@/hooks/use-content-image";
import { useContentFileOpener } from "@/hooks/use-content-file-opener";
import { loadPendingMedia } from "@/lib/pending-media";
import { useProjectAccess } from "@/lib/project-access-provider";
import { features } from "@/lib/feature-access";
export interface GalleryMedia {
    id: string;
    type: "photo" | "video";
    url: string;
    fileName?: string;
    staged?: boolean;
}
function MediaPreview({ media, position, total, }: {
    media: GalleryMedia;
    position: number;
    total: number;
}) {
    const { scope, generation, allows } = useProjectAccess();
    const permitted = allows(features.updates.read);
    const fileId = !media.staged ? /\/files\/([\w-]+)\/(?:view|download)(?:[?#]|$)/.exec(media.url)?.[1] ?? "" : "";
    const image = useContentImage(media.type === "photo" ? fileId : "", scope?.projectId);
    const [local, setLocal] = useState({ key: "", uri: "", error: "" });
    const key = `${media.id}:${media.url}:${scope?.projectId}:${generation}`;
    const [expanded, setExpanded] = useState(false);
    const file = useContentFileOpener(scope?.projectId);
    useEffect(() => {
        let active = true;
        if (media.staged && permitted)
            void loadPendingMedia(media.url)
                .then((uri) => {
                if (active)
                    setLocal({ key, uri, error: "" });
            })
                .catch(() => {
                if (active)
                    setLocal({ key, uri: "", error: "This attachment is no longer on this device." });
            });
        return () => { active = false; };
    }, [key, media.staged, media.url, permitted]);
    if (!permitted)
        return null;
    if (media.type === "video")
        return <div className="field-stack min-h-56 items-center justify-center gap-2 rounded-xl bg-surface-alt p-4">
    <Text weight="semibold">Video attachment</Text>
    {fileId ? <Button variant="secondary" onPress={() => void file.open(fileId)}>Open video</Button> : <Text tone="secondary">Video saved on this device. Playback is available after upload.</Text>}
    {file.error ? <Text tone="danger">{file.error}</Text> : null}
  </div>;
    const uri = media.staged ? local.key === key ? local.uri : "" : fileId ? image.url : /^https:\/\//.test(media.url) ? media.url : "";
    const error = media.staged ? local.key === key ? local.error : "" : image.error;
    const name = media.fileName || "Update photo";
    if (!uri)
        return <div style={{ aspectRatio: 4 / 3 }} className="field-stack items-center justify-center rounded-xl bg-surface-alt p-4">
    {error ? <Text tone="secondary">{error}</Text> : <Spinner />}
  </div>;
    return <div style={{ aspectRatio: 4 / 3 }} className="field-stack overflow-hidden rounded-xl bg-surface-alt">
    <button className="flex-1" role="button" aria-label={`Open ${name}`} onClick={() => setExpanded(true)} type="button">
      <Image source={{ uri }} contentFit="cover" aria-label={name} style={{ height: "100%", width: "100%" }}/>
    </button>
    {total > 1 ? <div style={{ pointerEvents: "none" }} className="field-stack absolute right-3 top-3 rounded-full bg-black-500/70 px-2.5 py-1">
      <Text tone="inverse" weight="semibold" className="text-xs">{position + 1} / {total}</Text>
    </div> : null}
    <ImageModal url={uri} name={name} visible={expanded} onClose={() => setExpanded(false)}/>
  </div>;
}
export function MediaGallery({ media }: {
    media: readonly GalleryMedia[];
}) {
    const { allows } = useProjectAccess();
    const [width, setWidth] = useState(0);
    const viewport = useRef<HTMLDivElement>(null);
    useEffect(() => { const node = viewport.current; if (!node)
        return; const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width)); observer.observe(node); return () => observer.disconnect(); }, []);
    const [index, setIndex] = useState(0);
    if (!allows(features.updates.read) || !media.length)
        return null;
    const position = Math.min(index, media.length - 1);
    if (media.length === 1)
        return <MediaPreview media={media[0]!} position={0} total={1}/>;
    const updatePosition = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width)
            setIndex(Math.min(media.length - 1, Math.max(0, Math.round(nativeEvent.contentOffset.x / width))));
    };
    return <div className="field-stack gap-2" ref={viewport}>
    {width ? <FlatList data={media} horizontal pagingEnabled decelerationRate="fast" showsHorizontalScrollIndicator={false} onMomentumScrollEnd={updatePosition} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })} keyExtractor={(item) => item.id} renderItem={({ item, index: itemIndex }) => <div className="field-stack" style={{ width }}>
        <MediaPreview media={item} position={itemIndex} total={media.length}/>
      </div>} aria-label={`${media.length} update attachments. Swipe to browse.`}/> : <div style={{ aspectRatio: 4 / 3 }} className="field-stack rounded-xl bg-surface-alt"/>}
    <div role="summary" aria-label={`Attachment ${position + 1} of ${media.length}`} className="field-stack flex-row justify-center gap-1.5">
      {media.map((item, itemIndex) => <div key={item.id} className={"field-stack " + (`h-1.5 rounded-full ${itemIndex === position ? "w-4 bg-primary-500" : "w-1.5 bg-grey-200"}`)}/>)}
    </div>
  </div>;
}
