import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";

// Metro cannot emit pdfjs's real Worker file, so preload the worker module on
// globalThis — pdfjs's fake-worker path finds WorkerMessageHandler there and
// parses on the main thread instead of spawning a Worker.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

// pdfjs v6 needs Promise.withResolvers and Promise.try (ES2024/ES2025);
// WKWebView on older iOS lacks both.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
if (typeof Promise.try !== "function") {
  Promise.try = function <T, U extends unknown[]>(
    callbackFn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ) {
    return new Promise<T>((resolve) => resolve(callbackFn(...args))) as Promise<Awaited<T>>;
  };
}

// pdfjs also uses the Uint8Array base64/hex proposal, still missing here.
interface U8Patch {
  toHex?: (this: Uint8Array) => string;
  toBase64?: (this: Uint8Array) => string;
}
const u8proto = Uint8Array.prototype as unknown as U8Patch;
if (typeof u8proto.toHex !== "function") {
  u8proto.toHex = function (this: Uint8Array) {
    let out = "";
    for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, "0");
    return out;
  };
}
if (typeof u8proto.toBase64 !== "function") {
  u8proto.toBase64 = function (this: Uint8Array) {
    let bin = "";
    for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
    return btoa(bin);
  };
}
const u8ctor = Uint8Array as unknown as { fromBase64?: (b64: string) => Uint8Array };
if (typeof u8ctor.fromBase64 !== "function") {
  u8ctor.fromBase64 = (b64: string) => {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  };
}

// …and the Map/WeakMap upsert proposal and URL.parse (Safari 18+).
interface MapPatch {
  getOrInsertComputed?: <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V) => V;
}
const mapProto = Map.prototype as unknown as MapPatch;
if (typeof mapProto.getOrInsertComputed !== "function") {
  mapProto.getOrInsertComputed = function <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V): V {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key) as V;
  };
}
interface WeakMapPatch {
  getOrInsertComputed?: <K extends WeakKey, V>(this: WeakMap<K, V>, key: K, callback: (key: K) => V) => V;
}
const weakMapProto = WeakMap.prototype as unknown as WeakMapPatch;
if (typeof weakMapProto.getOrInsertComputed !== "function") {
  weakMapProto.getOrInsertComputed = function <K extends WeakKey, V>(
    this: WeakMap<K, V>,
    key: K,
    callback: (key: K) => V,
  ): V {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key) as V;
  };
}
const urlCtor = URL as unknown as { parse?: (url: string, base?: string | URL) => URL | null };
if (typeof urlCtor.parse !== "function") {
  urlCtor.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
const mathObj = Math as Math & { sumPrecise?: (values: Iterable<number>) => number };
if (typeof mathObj.sumPrecise !== "function") {
  // Kahan-compensated sum stands in for the exact-summation proposal; pdfjs
  // only uses it for font metrics, where compensated precision is plenty.
  mathObj.sumPrecise = (values: Iterable<number>) => {
    let sum = 0;
    let compensation = 0;
    for (const value of values) {
      const t = sum + value;
      compensation += Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum;
      sum = t;
    }
    return sum + compensation;
  };
}

const abProto = ArrayBuffer.prototype as unknown as {
  transferToFixedLength?: (this: ArrayBuffer, newByteLength?: number) => ArrayBuffer;
};
if (typeof abProto.transferToFixedLength !== "function") {
  // Copy-only stand-in: real transfer also detaches the source, so callers
  // never reuse it — skipping detachment is observably equivalent here.
  abProto.transferToFixedLength = function (this: ArrayBuffer, newByteLength?: number) {
    const length = newByteLength ?? this.byteLength;
    const out = new ArrayBuffer(length);
    new Uint8Array(out).set(new Uint8Array(this, 0, Math.min(length, this.byteLength)));
    return out;
  };
}
