export interface ToolSchema {
  type?: string | string[];
  properties?: Record<string, ToolSchema>;
  required?: string[];
  additionalProperties?: boolean | ToolSchema;
  items?: ToolSchema;
  enum?: unknown[];
  const?: unknown;
  oneOf?: ToolSchema[];
  anyOf?: ToolSchema[];
  allOf?: ToolSchema[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface ToolOption {
  value: string;
  label: string;
  parentId?: string;
  buildingId?: string;
  versionId?: string;
}

export interface ToolField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  htmlField?: string;
  images?: boolean;
  choices?: string[];
  source?: string;
  sourceBy?: { field: string; sources: Record<string, string> };
  min?: number;
  max?: number;
  helpText?: string;
}

export interface ToolDescriptor {
  kind: string;
  label: string;
  description: string;
  schema: ToolSchema;
  fields: ToolField[];
  requiresBuilding: boolean;
  destructive?: boolean;
}

export interface ToolCatalog {
  tools: ToolDescriptor[];
  targets?: Record<string, unknown>;
  uploads?: boolean;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
}
