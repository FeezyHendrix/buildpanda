import { lazy, Suspense, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadBimDialog } from "@/components/molecules/upload-bim-dialog";
import type { SelectedElement } from "@/components/molecules/bim-viewer";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useBimModelFileUrl,
  useBimModels,
  useCreateBimIssue,
} from "@/hooks/use-bim";
import { useParticipants } from "@/hooks/use-participants";
import type { BimModel } from "@/lib/project-types";

const BimViewer = lazy(() => import("@/components/molecules/bim-viewer"));

const STATUS_META: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  Processing: { label: "Processing", tone: "info" },
  Ready: { label: "Ready", tone: "success" },
  Failed: { label: "Failed", tone: "danger" },
};

function ModelCard({
  model,
  onOpen,
  canOpen,
}: {
  model: BimModel;
  onOpen: (model: BimModel) => void;
  canOpen: boolean;
}) {
  const meta = model.status ? STATUS_META[model.status] : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{model.name}</p>
          {model.discipline && <p className="text-xs text-gray-500">{model.discipline}</p>}
          {model.elementCount != null && (
            <p className="mt-1 text-xs text-gray-400">{model.elementCount} elements</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {meta && (
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={!canOpen || model.status !== "Ready"}
            onClick={() => onOpen(model)}
          >
            Open viewer
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ProjectBim() {
  const { project, access } = useProjectContext();
  const canUpload = access?.capabilities?.canManage ?? false;

  const { data: models = [], isLoading } = useBimModels(project.id);
  const fileUrl = useBimModelFileUrl();
  const createIssue = useCreateBimIssue();
  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  const [uploadOpen, setUploadOpen] = useState(false);
  const [active, setActive] = useState<BimModel | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueAssignee, setIssueAssignee] = useState("");

  function openViewer(model: BimModel): void {
    setActive(model);
    setSelected(null);
    fileUrl.mutate(
      { projectId: project.id, modelId: model.id },
      { onSuccess: (data) => setModelUrl(data.url) },
    );
  }

  function closeViewer(): void {
    setActive(null);
    setModelUrl(null);
    setSelected(null);
  }

  function addIssue(): void {
    if (!active || issueTitle.trim() === "") return;
    createIssue.mutate(
      {
        projectId: project.id,
        modelId: active.id,
        title: issueTitle,
        elementGuid: selected?.guid ?? null,
        assigneeId: issueAssignee || null,
      },
      {
        onSuccess: () => {
          setIssueTitle("");
          setIssueAssignee("");
        },
      },
    );
  }

  if (active) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] w-full flex-col px-6 py-6 sm:px-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{active.name}</h2>
            <p className="text-xs text-gray-500">Click an element to anchor a coordination issue.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={closeViewer}>
            Back to models
          </Button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
          <div className="min-h-[400px]">
            {modelUrl ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center rounded-xl bg-[#1a1a1a] text-sm text-white/70">
                    Loading viewer…
                  </div>
                }
              >
                <BimViewer fileUrl={modelUrl} onSelect={setSelected} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl bg-[#1a1a1a] text-sm text-white/70">
                Preparing model…
              </div>
            )}
          </div>
          <Card className="flex flex-col gap-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Selected element
            </p>
            {selected?.guid ? (
              <div className="rounded-lg bg-[#F6F6F6] p-3 text-sm">
                <p className="font-medium text-gray-900">{selected.name ?? "Element"}</p>
                <p className="mt-1 break-all text-xs text-gray-500">{selected.guid}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No element selected.</p>
            )}

            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Raise a coordination issue
            </p>
            <input
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder="e.g. Beam clashes with duct"
              className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            />
            <select
              value={issueAssignee}
              onChange={(e) => setIssueAssignee(e.target.value)}
              className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={addIssue}
              disabled={issueTitle.trim() === "" || createIssue.isPending}
            >
              {selected?.guid ? "Add issue on element" : "Add issue"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="BIM models"
        description="Upload IFC models and view them in 3D. Anchor coordination issues to elements and promote them to RFIs."
        actions={
          canUpload ? (
            <Button variant="primary" size="md" onClick={() => setUploadOpen(true)}>
              <PlusIcon className="size-4" />
              Upload IFC
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : models.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-gray-500">No BIM models yet.</p>
            {canUpload && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setUploadOpen(true)}
              >
                Upload your first IFC
              </Button>
            )}
          </Card>
        ) : (
          models.map((model) => (
            <ModelCard key={model.id} model={model} onOpen={openViewer} canOpen={true} />
          ))
        )}
      </div>

      <UploadBimDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={project.id} />
    </div>
  );
}
