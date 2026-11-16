import type { ToolCatalog, ToolDescriptor, ToolField, ToolSchema, UploadedFile } from "../api/tool-types";

export interface ReviewFieldContext {
  projectId: string;
  descriptor: ToolDescriptor;
  catalog: ToolCatalog;
  disabled: boolean;
  onPending: (delta: number) => void;
}

export interface ReviewFieldProps {
  schema: ToolSchema;
  value: unknown;
  name: string;
  path: string;
  required?: boolean;
  context: ReviewFieldContext;
  hint?: ToolField;
  onChange: (value: unknown) => void;
  onFile?: (file: UploadedFile) => void;
}
