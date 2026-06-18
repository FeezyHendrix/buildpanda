import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface IfcLine {
  GlobalId?: { value?: string };
  Name?: { value?: string };
}

interface WebIfcModule {
  IfcAPI: new () => {
    Init(): Promise<void>;
    OpenModel(data: Uint8Array): number;
    CloseModel(modelID: number): void;
    GetAllTypesOfModel(modelID: number): { typeID: number; typeName: string }[];
    GetLineIDsWithType(modelID: number, type: number): { size(): number; get(i: number): number };
    GetLine(modelID: number, expressID: number): IfcLine;
  };
}

export interface ExtractedElement {
  guid: string;
  expressId: number;
  ifcType: string | null;
  name: string | null;
}

export interface IfcExtractResult {
  elements: ExtractedElement[];
}

export async function extractIfcElements(buffer: Buffer): Promise<IfcExtractResult> {
  const WebIFC = require("web-ifc") as WebIfcModule;
  const ifc = new WebIFC.IfcAPI();
  await ifc.Init();

  const modelID = ifc.OpenModel(new Uint8Array(buffer));
  try {
    const elements: ExtractedElement[] = [];
    const types = ifc.GetAllTypesOfModel(modelID);
    for (const { typeID, typeName } of types) {
      const ids = ifc.GetLineIDsWithType(modelID, typeID);
      for (let i = 0; i < ids.size(); i++) {
        const expressId = ids.get(i);
        const line = ifc.GetLine(modelID, expressId);
        const guid = line?.GlobalId?.value;
        if (!guid) continue;
        elements.push({
          guid,
          expressId,
          ifcType: typeName ?? null,
          name: line?.Name?.value ?? null,
        });
      }
    }
    return { elements };
  } finally {
    ifc.CloseModel(modelID);
  }
}
