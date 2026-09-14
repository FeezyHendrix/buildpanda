import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

export function ComplianceTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-alt py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <ReactSVG src={icons.shield} className="h-6 w-6 text-ink-muted" />
        </div>
        <h3 className="text-sm font-semibold text-ink">Compliance & Data Protection</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          BuildPanda is committed to keeping your data secure and protected. Dedicated compliance tools are coming soon.
        </p>
        <div className="mt-6 flex gap-4 text-sm text-primary-600">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <span>&middot;</span>
          <a href="#" className="hover:underline">Data Processing Agreement</a>
        </div>
      </div>
    </div>
  );
}
