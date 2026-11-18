import Ionicons from "@/components/atoms/icon";
import { useState } from "react";
import { TextInput } from "@/platform/browser";
import { Text } from "@/components/atoms";
import { ICON_STRONG, ICON_SUBTLE } from "@/constants/colors";
// Setting a scale is the web's Calibrate (plan-review-stage.tsx): draw a
// measure along a length you know, then say how long it really is. That is
// two short steps beside the sheet, not a record, so it is an inline prompt
// where the tool hint normally sits — never a bottom sheet.
export type ScalePromptStage = "draw" | "enter";
export function ScalePrompt({ stage, onCancel, onSave, }: {
    stage: ScalePromptStage;
    onCancel: () => void;
    /** The drawn line's real length, in metres, already checked to be positive. */
    onSave: (metres: number) => void;
}) {
    const [input, setInput] = useState("");
    const metres = Number.parseFloat(input.replace(",", "."));
    const valid = Number.isFinite(metres) && metres > 0;
    return (<div className="field-stack border-t border-hairline bg-surface px-4 py-2">
      <div className="field-stack flex-row items-center gap-3">
        <Ionicons name="resize-outline" size={18} color={ICON_STRONG}/>
        <div className="field-stack flex-1">
          <Text weight="semibold" className="text-[13px]">
            {stage === "draw" ? "Set the sheet's scale" : "How long is that line?"}
          </Text>
          <Text tone="secondary" className="text-xs">
            {stage === "draw"
            ? "Draw a line along a length you know — a door, a grid bay."
            : "Enter its real length. Every measure on this revision will use it."}
          </Text>
        </div>
        <button onClick={onCancel} role="button" aria-label="Cancel setting scale" className="h-11 w-11 items-center justify-center" type="button">
          <Ionicons name="close" size={20} color={ICON_STRONG}/>
        </button>
      </div>
      {stage === "enter" ? (<div className="field-stack flex-row items-center gap-2 pt-2">
          <div className="field-stack h-14 flex-1 flex-row items-center rounded-xl bg-surface-alt px-4">
            <TextInput value={input} onChangeText={setInput} keyboardType="decimal-pad" autoFocus placeholder="e.g. 3.6" placeholderTextColor={ICON_SUBTLE} aria-label="Real length in metres" className="flex-1 font-inter text-base text-black-500" onSubmitEditing={() => valid && onSave(metres)}/>
            <Text tone="secondary" className="text-sm">
              m
            </Text>
          </div>
          <button onClick={() => valid && onSave(metres)} disabled={!valid} role="button" aria-label="Save scale" aria-disabled={!valid} className={`h-14 justify-center rounded-xl px-5 ${valid ? "bg-primary-500" : "bg-grey-50"}`} type="button">
            <Text weight="semibold" tone={valid ? "inverse" : "muted"} className="text-sm">
              Save
            </Text>
          </button>
        </div>) : null}
    </div>);
}
ScalePrompt.displayName = "ScalePrompt";
