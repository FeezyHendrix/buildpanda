export function PreconSessionSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6 animate-pulse motion-reduce:animate-none" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-3 w-32 rounded bg-gray-100" />
      </div>
      <div className="flex gap-6 border-b border-line pb-3">
        <div className="h-6 w-24 rounded bg-gray-200" />
        <div className="h-6 w-24 rounded bg-gray-100" />
        <div className="h-6 w-24 rounded bg-gray-100" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex-1 rounded-lg border border-line bg-white p-4">
          <div className="h-full rounded bg-gray-50" />
        </div>
        <div className="w-[400px] space-y-3 rounded-lg border border-line bg-white p-4">
          <div className="h-6 w-32 rounded bg-gray-200" />
          <div className="h-16 rounded border border-line-hair bg-gray-50" />
          <div className="h-16 rounded border border-line-hair bg-gray-50" />
        </div>
      </div>
    </div>
  );
}
PreconSessionSkeleton.displayName = "PreconSessionSkeleton";
