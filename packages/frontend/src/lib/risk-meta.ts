import type { BadgeTone } from "@/components/atoms/badge";
import type { RiskLevel, RiskStatus } from "@/lib/project-types";

/**
 * Severity and status carry a shape as well as a tone: ~8% of men cannot tell
 * the amber from the red, so the register never says "High" with colour alone.
 */
export const RISK_SEVERITY_META: Record<RiskLevel, { label: string; tone: BadgeTone; shape: string }> = {
  Low: { label: "Low", tone: "info", shape: "▼" },
  Medium: { label: "Medium", tone: "warning", shape: "▬" },
  High: { label: "High", tone: "danger", shape: "▲" },
};

export const RISK_STATUS_META: Record<RiskStatus, { label: string; tone: BadgeTone; hint: string }> = {
  open: { label: "Open", tone: "warning", hint: "Live — still able to hurt the job." },
  mitigated: { label: "Mitigated", tone: "info", hint: "A response is in place; the exposure is reduced." },
  closed: { label: "Closed", tone: "neutral", hint: "No longer a risk — it cannot happen now." },
  occurred: { label: "Occurred", tone: "danger", hint: "It happened. Keep the record; it is evidence." },
};
