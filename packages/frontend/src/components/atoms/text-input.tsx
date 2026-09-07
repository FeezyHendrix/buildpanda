import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value?: string;
  optional?: boolean;
  onChange?: (v: string) => void;
}

export function TextInput({
  label,
  optional,
  onChange,
  className,
  ...props
}: TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-[#1E1E1E]">
          {label}
          {optional && <span className="ml-1 font-normal text-[#B0B0B0]">(optional)</span>}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "h-11 border-[0.5px] border-[#EBEBEB] bg-white px-3.5 text-caption-l text-black-500 placeholder:text-[#B0B0B0] outline-none transition-colors focus:border-black-500 focus:ring-1 focus:ring-black-500/10",
          props.disabled && "cursor-not-allowed bg-gray-50 text-black-500",
          className,
        )}
      />
    </div>
  );
}