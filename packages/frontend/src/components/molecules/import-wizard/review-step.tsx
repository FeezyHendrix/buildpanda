import { useImportSession } from "@/hooks/use-import-session";
import { Spinner } from "@/components/atoms/spinner";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { SessionDocumentStatus } from "@/hooks/use-import-session";

interface ReviewStepProps {
  sessionId: string;
}

export function ReviewStep({ sessionId }: ReviewStepProps) {
  const { data: session, isPending } = useImportSession(sessionId);

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Spinner className="h-8 w-8 text-[#004DE7]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center p-12 text-gray-500">
        Failed to load session details.
      </div>
    );
  }

  const getStatusBadge = (status: SessionDocumentStatus) => {
    switch (status) {
      case "applied":
      case "ready":
        return <Badge className="bg-green-100 text-green-800 border-none">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 border-none">Failed</Badge>;
      case "skipped":
        return <Badge className="bg-gray-100 text-gray-800 border-none">Skipped</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-none">Processing</Badge>;
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Almost done</h2>
      <p className="text-gray-500 mb-8">Review your imported files before opening the project.</p>

      {session.documents.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200 text-gray-500">
          {session.projectId ? "Your project is ready." : "No files were uploaded during this session."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {session.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-col">
                <span className="font-medium text-gray-900 capitalize">{doc.kind}</span>
                <span className="text-sm text-gray-500">{doc.fileName || "Unknown file"}</span>
                {doc.error && <span className="text-xs text-red-500 mt-1">{doc.error}</span>}
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(doc.status)}
                {doc.status === "failed" && (
                  <Button variant="ghost" size="sm" className="text-sm text-[#004DE7]">
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
