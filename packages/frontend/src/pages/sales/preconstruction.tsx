import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { PageHeader } from "@/components/molecules/page-header";
import { useCreatePreconSession, usePreconSessions } from "@/hooks/use-precon";
import type { PreconSession, PreconSessionStatus } from "@/api/precon";
import { formatDayMonth } from "@/lib/formatters";

const STATUS_META: Record<PreconSessionStatus, { label: string; tone: "info" | "warning" | "success" | "danger" }> = {
  uploading: { label: "Uploading", tone: "info" },
  generating: { label: "Generating", tone: "warning" },
  reviewing: { label: "In review", tone: "warning" },
  output: { label: "Bid-ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

function SessionCard({ session, onOpen }: { session: PreconSession; onOpen: (id: string) => void }) {
  const meta = STATUS_META[session.status];
  return (
    <button
      type="button"
      onClick={() => onOpen(session.id)}
      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-primary-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{session.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">Started {formatDayMonth(session.createdAt)}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      {session.error ? <p className="mt-2 text-xs text-red-600">{session.error}</p> : null}
    </button>
  );
}
SessionCard.displayName = "SessionCard";

export default function PreconstructionPage() {
  const navigate = useNavigate();
  const { data: sessions = [], isPending } = usePreconSessions();
  const create = useCreatePreconSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openSession = (sessionId: string) => navigate(`/sales/preconstruction/${sessionId}`);

  const onFilesPicked = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    create.mutate(
      { files: [...fileList] },
      {
        onSuccess: (session) => openSession(session.id),
        onError: (error) => setUploadError(error instanceof Error ? error.message : "Upload failed"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Preconstruction"
        description="Upload drawings; Panda AI measures a draft Bill of Quantities for QS review."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.dwg"
              multiple
              className="hidden"
              onChange={(e) => {
                onFilesPicked(e.target.files);
                e.target.value = "";
              }}
            />
            <Button loading={create.isPending} onClick={() => fileInputRef.current?.click()}>
              New takeoff
            </Button>
          </>
        }
      />

      {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-gray-900">No takeoff sessions yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Upload architectural PDF (or DWG) drawings and Panda AI will draft a measured BOQ. Every AI figure stays a
            draft until a human verifies it.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} onOpen={openSession} />
          ))}
        </div>
      )}
    </div>
  );
}
