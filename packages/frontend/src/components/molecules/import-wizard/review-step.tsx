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
        <Spinner className="h-8 w-8 text-primary-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center p-12 text-ink-muted">
        Failed to load session details.
      </div>
    );
  }

  const getStatusBadge = (status: SessionDocumentStatus) => {
    switch (status) {
      case "applied":
      case "ready":
        return <Badge tone="success" dot>Success</Badge>;
      case "failed":
        return <Badge tone="danger" dot>Failed</Badge>;
      case "skipped":
        return <Badge tone="neutral" dot>Skipped</Badge>;
      default:
        return <Badge tone="info" dot>Processing</Badge>;
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-semibold text-ink mb-2">Almost done</h2>
      <p className="text-ink-muted mb-8">Review your imported files before opening the project.</p>

      {session.documents.length === 0 ? (
        <div className="p-8 text-center bg-surface-alt rounded-lg border border-line-hair text-ink-muted">
          {session.projectId ? "Your project is ready." : "No files were uploaded during this session."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {session.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border border-line-hair bg-white">
              <div className="flex flex-col">
                <span className="font-medium text-ink capitalize">{doc.kind}</span>
                <span className="text-sm text-ink-muted">{doc.fileName || "Unknown file"}</span>
                {doc.error && <span className="text-xs text-negative-500 mt-1">{doc.error}</span>}
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(doc.status)}
                {doc.status === "failed" && (
                  <Button variant="ghost" size="sm" className="text-sm text-primary-500">
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
