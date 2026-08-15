import { cn } from "@/lib/utils";

export function TextInput({
  label,
  placeholder,
  value,
  onChange,
  optional,
  type = "text",
  disabled,
  required,
}: {
  type?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange?: (v: string) => void;
  optional?: boolean;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#1E1E1E]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#B0B0B0]">(optional)</span>}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "h-11 border-[0.5px] border-[#EBEBEB] bg-white px-3.5 text-caption-l text-black-500 placeholder:text-[#B0B0B0] outline-none transition-colors focus:border-black-500 focus:ring-1 focus:ring-black-500/10",
          disabled && "cursor-not-allowed bg-gray-50 text-black-500",
        )}
      />
    </div>
  );
}