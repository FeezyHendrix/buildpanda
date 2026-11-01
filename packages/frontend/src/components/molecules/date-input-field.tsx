import { type InputHTMLAttributes } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

type DateInputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange: (value: string) => void;
};

/**
 * A date field with the app's calendar icon as a suffix. The native picker
 * indicator is hidden and the whole field opens the picker, as on Key dates.
 */
function DateInputField({ className, onChange, ...props }: DateInputFieldProps) {
  return (
    <div className="relative">
      <input
        {...props}
        type="date"
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className={cn(INPUT_CLASS, "cursor-pointer pr-11 [&::-webkit-calendar-picker-indicator]:hidden", className)}
      />
      <ReactSVG
        src={icons2.calendar}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 [&_svg]:size-4"
      />
    </div>
  );
}

DateInputField.displayName = "DateInputField";

export { DateInputField };
