import { useEffect, useRef, useState } from "react";
import type { SelectedElement } from "./bim-viewer";

interface Props {
  xktUrl: string;
  onSelect?: (element: SelectedElement | null) => void;
}

interface MetaProperty {
  name?: string;
  value?: unknown;
}

interface MetaPropertySet {
  properties?: MetaProperty[];
}

interface MetaObject {
  id: string;
  name?: string;
  type?: string;
  propertySets?: MetaPropertySet[];
}

function toSelectedElement(meta: MetaObject | undefined, entityId: string): SelectedElement {
  if (!meta) {
    return { guid: entityId, expressId: null, name: null, ifcType: null, properties: [] };
  }
  const properties: { label: string; value: string }[] = [];
  for (const ps of meta.propertySets ?? []) {
    for (const prop of ps.properties ?? []) {
      if (prop?.name != null && prop.value != null && prop.value !== "") {
        properties.push({ label: prop.name, value: String(prop.value) });
      }
    }
  }
  return {
    guid: meta.id ?? entityId,
    expressId: null,
    name: meta.name ?? null,
    ifcType: meta.type ?? null,
    properties: properties.slice(0, 20),
  };
}

export default function XeokitViewer({ xktUrl, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading model…");

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { Viewer, XKTLoaderPlugin } = await import("@xeokit/xeokit-sdk");
      if (disposed) return;

      const viewer = new Viewer({ canvasElement: canvas, transparent: false });
      viewer.scene.camera.eye = [-30, 30, 60];
      viewer.scene.camera.look = [0, 0, 0];
      viewer.scene.camera.up = [0, 1, 0];

      const xktLoader = new XKTLoaderPlugin(viewer);
      const model = xktLoader.load({ id: "model", src: xktUrl, edges: true });

      model.on("loaded", () => {
        if (disposed) return;
        setStatus("ready");
        viewer.cameraFlight.flyTo(model);
      });
      model.on("error", (err: unknown) => {
        if (disposed) return;
        setStatus("error");
        setMessage(typeof err === "string" ? err : "Failed to load model");
      });

      viewer.scene.input.on("mouseclicked", (coords: number[]) => {
        const hit = viewer.scene.pick({ canvasPos: coords });
        if (!hit || !hit.entity) {
          onSelect?.(null);
          return;
        }
        const entityId = String(hit.entity.id);
        const meta = viewer.metaScene.metaObjects[entityId] as MetaObject | undefined;
        onSelect?.(toSelectedElement(meta, entityId));
      });

      cleanup = () => {
        try {
          viewer.destroy();
        } catch {
          void 0;
        }
      };
    }

    void run();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [xktUrl, onSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#1a1a1a]">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 select-none rounded-md bg-black/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-white/80 backdrop-blur-sm">
        BuildPanda · BIM
      </div>
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <p className={status === "error" ? "text-sm text-red-300" : "text-sm text-white/80"}>
            {status === "error" ? message : "Loading model…"}
          </p>
        </div>
      )}
    </div>
  );
}
