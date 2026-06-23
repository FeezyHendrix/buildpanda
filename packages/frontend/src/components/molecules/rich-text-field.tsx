import { useId } from "react";
import { Label } from "@/components/atoms/label";
import {
  RichTextEditor,
  type UploadedAttachment,
  type RichTextEditorHandle,
} from "@/components/molecules/rich-text-editor";
import { cn } from "@/lib/utils";

interface RichTextFieldProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  onChangeText?: (text: string) => void;
  onAttach?: (attachment: UploadedAttachment) => void;
  projectId?: string;
  onReady?: (handle: RichTextEditorHandle) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function RichTextField({
  label,
  value,
  onChange,
  onChangeText,
  onAttach,
  projectId,
  onReady,
  placeholder,
  disabled,
  required,
  className,
}: RichTextFieldProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <div id={id}>
        <RichTextEditor
          value={value}
          onChange={(html, text) => {
            onChange(html);
            onChangeText?.(text);
          }}
          onAttach={onAttach}
          projectId={projectId}
          onReady={onReady}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

RichTextField.displayName = "RichTextField";
