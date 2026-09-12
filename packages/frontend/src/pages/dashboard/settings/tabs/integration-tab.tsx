import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

export function IntegrationTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-alt py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <ReactSVG src={icons.teams} className="h-6 w-6 text-ink-muted" />
      </div>
      <h3 className="text-sm font-semibold text-ink">Integrations coming soon</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        We're working on connecting BuildPanda with your favorite tools. Check back later.
      </p>
    </div>
  );
}
