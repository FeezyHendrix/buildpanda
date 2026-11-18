import { ContentText } from "@/components/rich-text/rich-content";
import { useProjectAccess } from "@/lib/project-access-provider";
import { voiceRequirement } from "@/lib/voice-access";
import Ionicons from "@/components/atoms/icon";
import { actionDefinition } from "@buildpanda/voice-actions";
import type { ComponentProps } from "react";
import type { ProposedAction } from "@/api/voice-report-types";
import { Card, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_DANGER, ICON_FAINT } from "@/constants/colors";
import { actionFields, reviewErrors, reviewValues, outstandingFields, type MissingFieldValues, type ReviewValue } from "@/lib/voice-missing-fields";
import { cn } from "@/lib/utils";
import { VoiceReviewForm } from "./voice-review-form";
/** Icon + words, never colour alone — the badge has to read on a bright site. */
function NeedsBadge({ count }: {
    count: number;
}) {
    return (<div className="field-stack flex-row items-center gap-1 rounded-full bg-error-50 px-2 py-0.5">
      <Ionicons name="alert-circle" size={11} color={ICON_DANGER}/>
      <Text tone="danger" weight="semibold" className="text-[10px] uppercase">
        Needs {count} {count === 1 ? "detail" : "details"}
      </Text>
    </div>);
}
/**
 * The list of records Panda AI drafted from a voice note. Each row is a toggle:
 * included rows are created on confirm, excluded ones are dropped. Where the
 * speaker never said a required value the card collects it too, so only the
 * header row toggles — never the field area. Nothing here writes anything.
 */
export function VoiceActionsReview({ actions, includedIndexes, appliedIndexes, values, onToggle, onChangeField, }: {
    actions: ProposedAction[];
    includedIndexes: ReadonlySet<number>;
    appliedIndexes?: ReadonlySet<number>;
    values: MissingFieldValues;
    onToggle: (index: number) => void;
    onChangeField: (actionIndex: number, fieldName: string, value: ReviewValue) => void;
}) {
    const { allows } = useProjectAccess();
    return (<div className="field-stack gap-3">
      {actions.map((action, index) => {
            if (!allows(voiceRequirement(action)))
                return null;
            const meta = actionDefinition(action.kind);
            const applied = appliedIndexes?.has(index) ?? false;
            const included = includedIndexes.has(index);
            const answers = reviewValues(action, values[index]);
            const fields = actionFields(action);
            const showFields = included && !applied && fields.length > 0;
            const errors = reviewErrors(action, values[index]);
            const outstanding = showFields ? outstandingFields(action, answers).length : 0;
            return (<Card key={index} className={cn("p-4", !included && "opacity-50")}>
            <button disabled={applied} onClick={() => onToggle(index)} role="checkbox" aria-checked={included || applied} aria-disabled={applied} className="min-h-11 flex-row items-start gap-3" type="button">
              <div className={"field-stack " + (cn("h-10 w-10 items-center justify-center rounded-xl", meta.destructive ? "bg-error-50" : "bg-primary-50"))}>
                <Ionicons name={meta.icon as ComponentProps<typeof Ionicons>["name"]} size={20} color={meta.destructive ? ICON_DANGER : ICON_BRAND}/>
              </div>
              <div className="field-stack min-w-0 flex-1">
                <div className="field-stack flex-row flex-wrap items-center gap-2">
                  <Text tone={meta.destructive ? "danger" : "brand"} weight="semibold" className="text-[11px] uppercase">
                    {applied ? "Applied" : meta.label}
                  </Text>
                  {outstanding > 0 ? <NeedsBadge count={outstanding}/> : null}
                </div>
                <Text weight="semibold" className="pt-0.5 text-[15px]" numberOfLines={2}>
                  {action.title}
                </Text>
                <ContentText tone="secondary" className="pt-1 text-[13px]" value={action.summary}/>
                {/* a filled form is a record: show every answer, not a teaser */}
                {action.kind === "daily_log" && action.payload.formText ? (<div className="field-stack mt-2 rounded-lg bg-surface-alt px-3 py-2">
                    <Text weight="semibold" className="pb-1 text-[12px]">{action.payload.templateName ?? "Daily log form"}</Text>
                    <Text className="text-[13px]">{action.payload.formText}</Text>
                  </div>) : null}
                {meta.online ? <Text tone="secondary" className="pt-1 text-xs">Connection required</Text> : null}
              </div>
              <Ionicons name={included || applied ? "checkmark-circle" : "ellipse-outline"} size={24} color={included ? ICON_BRAND : ICON_FAINT}/>
            </button>

            {showFields ? (<div className="field-stack mt-4 gap-4 border-t border-hairline pt-4">
                {errors.length > 0 && outstanding === 0 ? <Text tone="danger">{errors.join(" ")}</Text> : null}
                <VoiceReviewForm fields={fields} values={answers} onChangeField={(fieldName, value) => onChangeField(index, fieldName, value)}/>
              </div>) : null}
          </Card>);
        })}
    </div>);
}
