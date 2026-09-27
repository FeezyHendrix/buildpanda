import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { ConvertPreviewDialog } from "@/components/molecules/convert-preview-dialog";
import { useConvertProposal, useProposalWorkspace } from "@/hooks/use-proposals";
import { useAbility } from "@/contexts/ability-context";
import type { ConvertInclude } from "@/api/proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { ActivityTab } from "./activity-tab";
import { MessagesTab } from "./messages-tab";
import { OverviewDetails } from "./overview-details";

interface Props {
  proposalId: string;
}

const LAST_SUITE_KEY = "buildpanda:last-suite";

function rememberConstructionSuite() {
  try {
    localStorage.setItem(LAST_SUITE_KEY, "construction");
  } catch {
    // private mode or quota: the suite switch is a convenience, not state
  }
}

// One page to read the proposal: who it is for, the brief, where it stands
// with the client, and the notes the team left. Drawings, take-offs, the
// estimate and the pack each have their own tab.
export function OverviewTab({ proposalId }: Props) {
  const { data } = useProposalWorkspace(proposalId);
  const convert = useConvertProposal(proposalId);
  const navigate = useNavigate();
  const ability = useAbility();
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!data) return null;
  const { proposal, estimate } = data;
  const canConvert = ability.can("convert", "proposals");

  function handleConvert(include: ConvertInclude) {
    convert.mutate(include, {
      onSuccess: ({ projectId }) => {
        setConfirmOpen(false);
        rememberConstructionSuite();
        navigate(`/project/${projectId}/overview`);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {proposal.projectId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Project created</h3>
            <p className="mt-0.5 text-xs text-gray-500">This proposal has been converted to a construction project.</p>
          </div>
          <Link to={`/project/${proposal.projectId}/overview`} onClick={rememberConstructionSuite}>
            <Button variant="secondary" size="sm">
              Go to project
            </Button>
          </Link>
        </div>
      ) : proposal.status === "Accepted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 p-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Ready to build</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {canConvert
                ? "The client has accepted. Convert it into a construction project to start tracking phases, milestones and finances."
                : "The client has accepted. An owner or admin can convert it into a construction project."}
            </p>
          </div>
          {canConvert ? (
            <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} loading={convert.isPending}>
              Convert to project
            </Button>
          ) : null}
        </div>
      ) : null}
      {canConvert ? (
        <ConvertPreviewDialog
          proposalId={proposalId}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          submitting={convert.isPending}
          error={convert.error ? getApiErrorMessage(convert.error, "Conversion failed. Please try again.") : null}
          onConfirm={handleConvert}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OverviewDetails proposalId={proposalId} proposal={proposal} canSaveTemplate={Boolean(estimate) && ability.can("update", "proposals")} />
        <div className="rounded-lg border border-line bg-white p-5">
          <h3 className="mb-2 text-xs font-medium uppercase text-ink-muted">Brief</h3>
          {proposal.brief ? (
            <p className="whitespace-pre-line text-sm text-gray-700">{proposal.brief}</p>
          ) : (
            <p className="text-sm text-gray-400">No brief was written for this proposal.</p>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase text-ink-muted">Activity</h2>
        <ActivityTab proposalId={proposalId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase text-ink-muted">Internal notes</h2>
        <MessagesTab proposalId={proposalId} />
      </section>
    </div>
  );
}
OverviewTab.displayName = "OverviewTab";
