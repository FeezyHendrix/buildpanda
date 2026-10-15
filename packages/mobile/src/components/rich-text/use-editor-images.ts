import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import { embeddedImages, type ContentImage } from "@buildpanda/rich-content";
import { useContentImageResolver } from "@/hooks/use-content-image";
import { editorImageSource } from "./image-source";
import { imageSize, type EditorImage } from "./html-document";

/** Mount inside a scope/access-version keyed editor. A late resolver can never
 * put an image into the next workspace or a newly revoked view. */
export function useEditorImages(html: string, projectId?: string) {
  const resolver = useContentImageResolver(projectId, "uri");
  const [images, setImages] = useState<EditorImage[]>([]);
  const current = useRef<EditorImage[]>([]);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const generation = useRef(0);
  const entries = useRef(new Map<string, Promise<EditorImage>>());
  const cleanup = useRef(new Set<() => void>());
  const resolve = useCallback((image: ContentImage): Promise<EditorImage> => {
    const existing = entries.current.get(image.fileId);
    if (existing) return existing;
    const version = generation.current;
    const isCurrent = () => alive.current && generation.current === version;
    const promise = (async () => {
      const uri = await resolver.resolve(image.fileId);
      const source = editorImageSource(uri);
      if (!isCurrent()) { source.dispose(); throw new Error("This field is no longer open."); }
      cleanup.current.add(source.dispose);
      // React Native Web still exposes the callback overload.
      const size = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(source.uri, (width, height) => resolve({ width, height }), () => resolve({ width: 240, height: 160 }));
      });
      const entry = { ...image, source: source.uri, ...imageSize(size.width, size.height) };
      if (!isCurrent()) throw new Error("This field is no longer open.");
      current.current = [...current.current, entry];
      setImages(current.current);
      return entry;
    })();
    entries.current.set(image.fileId, promise);
    return promise;
  }, [resolver.resolve]);
  useEffect(() => {
    alive.current = true;
    const disposals = cleanup.current;
    return () => {
      alive.current = false;
      generation.current += 1;
      entries.current.clear();
      current.current = [];
      for (const dispose of disposals) dispose();
      disposals.clear();
    };
  }, []);
  const references = JSON.stringify(embeddedImages(html));
  useEffect(() => {
    const version = generation.current;
    for (const image of JSON.parse(references) as ContentImage[]) {
      void resolve(image).catch((cause: unknown) => {
        if (alive.current && generation.current === version) setError(cause instanceof Error ? cause.message : "Image unavailable.");
      });
    }
  }, [references, resolve]);
  return { images, current, resolve, error };
}
