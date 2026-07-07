import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

export function IntegrationTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <ReactSVG src={icons.teams} className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">Integrations coming soon</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        We're working on connecting BuildPanda with your favorite tools. Check back later.
      </p>
    </div>
  );
}
