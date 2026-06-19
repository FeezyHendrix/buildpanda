import { createRequire } from "node:module";
import { convert2xkt } from "@xeokit/xeokit-convert/src/convert2xkt.js";

const require = createRequire(import.meta.url);

export interface XktConversionResult {
  buffer: Buffer;
  byteLength: number;
}

export async function convertIfcToXkt(ifc: Buffer): Promise<XktConversionResult> {
  const WebIFC = require("web-ifc") as object;
  let xkt: ArrayBuffer | undefined;
  await convert2xkt({
    WebIFC,
    sourceData: ifc.buffer.slice(ifc.byteOffset, ifc.byteOffset + ifc.byteLength),
    sourceFormat: "ifc",
    outputXKT: (arrayBuffer: ArrayBuffer) => {
      xkt = arrayBuffer;
    },
    log: () => {},
  });
  if (!xkt) throw new Error("convert2xkt produced no XKT output");
  const buffer = Buffer.from(xkt);
  return { buffer, byteLength: buffer.byteLength };
}

