import { useEffect, useRef, useState } from "react";
import type * as OBCTypes from "@thatopen/components";

export interface SelectedElement {
  guid: string | null;
  expressId: number | null;
  name: string | null;
  ifcType: string | null;
  properties: { label: string; value: string }[];
}

interface Props {
  fileUrl: string;
  onSelect?: (element: SelectedElement | null) => void;
}

const WASM_PATH = "https://unpkg.com/web-ifc@0.0.77/";

const HIDDEN_KEYS = new Set(["_guid", "_category", "_localId", "expressID", "Name"]);

function readValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && "value" in (raw as Record<string, unknown>)) {
    const v = (raw as { value: unknown }).value;
    if (v === null || v === undefined || v === "") return null;
    return String(v);
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  return null;
}

function toSelectedElement(item: Record<string, unknown>, expressId: number | null): SelectedElement {
  const guid = readValue(item._guid);
  const name = readValue(item.Name);
  const ifcType = readValue(item._category);
  const properties: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(item)) {
    if (HIDDEN_KEYS.has(key) || key.startsWith("_")) continue;
    const value = readValue(raw);
    if (value !== null) properties.push({ label: key, value });
  }
  return { guid, name, ifcType, expressId, properties: properties.slice(0, 20) };
}

export default function BimViewer({ fileUrl, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string>("Loading model…");

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let watermarkObserver: MutationObserver | undefined;

    async function run() {
      const container = containerRef.current;
      if (!container) return;

      const stripWatermark = () => {
        container.querySelectorAll("[data-thatopen-logo]").forEach((node) => node.remove());
      };
      watermarkObserver = new MutationObserver(stripWatermark);
      watermarkObserver.observe(container, { childList: true, subtree: true });

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

        // The IfcLoader produces fragments; in @thatopen v3 the FragmentsManager
        // must be initialized with its worker and each loaded model added to the
        // scene, otherwise nothing renders ("You need to initialize fragments first").
        const workerUrl = await OBC.FragmentsManager.getWorker();
        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(workerUrl);
        world.camera.controls.addEventListener("update", () => fragments.core.update());
        fragments.list.onItemSet.add(async ({ value: model }) => {
          model.useCamera(world.camera.three);
          world.scene.three.add(model.object);
          await fragments.core.update(true);
        });
        fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
          if (!("isLodMaterial" in material && material.isLodMaterial)) {
            material.polygonOffset = true;
            material.polygonOffsetUnits = 1;
            material.polygonOffsetFactor = Math.random();
          }
        });

        setMessage("Downloading model…");
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Could not load model (${res.status})`);
        const buffer = new Uint8Array(await res.arrayBuffer());
        if (disposed) return;

        setMessage("Rendering…");
        await ifcLoader.load(buffer, true, "project-model");
        if (disposed) return;
        await fragments.core.update(true);

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
                const first = (data[0] ?? {}) as Record<string, unknown>;
                onSelect(toSelectedElement(first, ids[0] ?? null));
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
      watermarkObserver?.disconnect();
      cleanup?.();
    };
  }, [fileUrl, onSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#1a1a1a] [&_[data-thatopen-logo]]:!hidden">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 select-none rounded-md bg-black/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-white/80 backdrop-blur-sm">
        BuildPanda · BIM
      </div>
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
