import { ChevronRightIcon, PandaMarkIcon } from "./icons";

export function PandaAiHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[#EDEDED] bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#004DE7]">
          <PandaMarkIcon className="h-5 w-auto" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">Panda AI</h2>
          <p className="text-xs text-gray-500">Project assistant</p>
        </div>
      </div>
      <button
        onClick={onClose}
        data-testid="panda-ai-collapse"
        className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
