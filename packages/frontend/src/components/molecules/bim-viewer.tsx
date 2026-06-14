import { useEffect, useRef, useState } from "react";
import type * as OBCTypes from "@thatopen/components";

export interface SelectedElement {
  guid: string | null;
  expressId: number | null;
  name: string | null;
}

interface Props {
  fileUrl: string;
  onSelect?: (element: SelectedElement | null) => void;
}

const WASM_PATH = "https://unpkg.com/web-ifc@0.0.77/";

export default function BimViewer({ fileUrl, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string>("Loading model…");

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function run() {
      const container = containerRef.current;
      if (!container) return;

      const OBC = await import("@thatopen/components");
      const OBF = await import("@thatopen/components-front");

      const components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      const world = worlds.create<
        OBCTypes.SimpleScene,
        OBCTypes.SimpleCamera,
        OBCTypes.SimpleRenderer
      >();
      world.scene = new OBC.SimpleScene(components);
      world.renderer = new OBC.SimpleRenderer(components, container);
      world.camera = new OBC.SimpleCamera(components);
      components.init();
      world.scene.setup();
      world.camera.controls.setLookAt(12, 8, 12, 0, 0, 0);

      components.get(OBC.Raycasters).get(world);

      try {
        const ifcLoader = components.get(OBC.IfcLoader);
        await ifcLoader.setup({ autoSetWasm: false, wasm: { path: WASM_PATH, absolute: true } });

        setMessage("Downloading model…");
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Could not load model (${res.status})`);
        const buffer = new Uint8Array(await res.arrayBuffer());
        if (disposed) return;

        setMessage("Rendering…");
        await ifcLoader.load(buffer, false, "project-model");
        if (disposed) return;

        const boxer = components.get(OBC.BoundingBoxer);
        boxer.list.clear();
        boxer.addFromModels();
        const box = boxer.get();
        boxer.list.clear();
        const THREE = await import("three");
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        if (sphere.radius > 0 && Number.isFinite(sphere.radius)) {
          await world.camera.controls.fitToSphere(sphere, true);
        }

        if (onSelect) {
          const highlighter = components.get(OBF.Highlighter);
          highlighter.setup({ world });
          const select = highlighter.events.select;
          if (select) {
            select.onHighlight.add(async (modelIdMap) => {
              const fragments = components.get(OBC.FragmentsManager);
              for (const [modelId, localIds] of Object.entries(modelIdMap)) {
                const model = fragments.list.get(modelId);
                if (!model) continue;
                const ids = [...(localIds as Set<number>)];
                const data = await model.getItemsData(ids);
                const first = data[0] as
                  | { _guid?: { value?: string }; Name?: { value?: string } }
                  | undefined;
                onSelect({
                  guid: first?._guid?.value ?? null,
                  expressId: ids[0] ?? null,
                  name: first?.Name?.value ?? null,
                });
                return;
              }
            });
            select.onClear.add(() => onSelect(null));
          }
        }

        if (!disposed) {
          setStatus("ready");
        }
      } catch (err) {
        if (!disposed) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Failed to load model");
        }
      }

      cleanup = () => {
        try {
          components.dispose();
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
  }, [fileUrl, onSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#1a1a1a]">
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <p className={status === "error" ? "text-sm text-red-300" : "text-sm text-white/80"}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
