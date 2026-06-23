import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { useConvertProposal, useProposalWorkspace } from "@/hooks/use-proposals";
import { useAbility } from "@/contexts/ability-context";
import { formatDayMonth, formatShortDate } from "@/lib/formatters";

interface Props {
  proposalId: string;
}

export function OverviewTab({ proposalId }: Props) {
  const { data } = useProposalWorkspace(proposalId);
  const convert = useConvertProposal(proposalId);
  const navigate = useNavigate();
  const ability = useAbility();
  if (!data) return null;
  const { proposal, events } = data;

  async function handleConvert() {
    const { projectId } = await convert.mutateAsync();
    localStorage.setItem("buildpanda:last-suite", "construction");
    navigate(`/project/${projectId}/overview`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Client
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{proposal.clientName}</dd>
            </div>
            {proposal.clientEmail && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700">{proposal.clientEmail}</dd>
              </div>
            )}
            {proposal.clientPhone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-700">{proposal.clientPhone}</dd>
              </div>
            )}
            {proposal.location && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Location</dt>
                <dd className="text-gray-700">{proposal.location}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Proposal
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Number</dt>
              <dd className="font-mono text-xs font-medium text-gray-700">{proposal.numberLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Currency</dt>
              <dd className="text-gray-700">{proposal.currency}</dd>
            </div>
            {proposal.validUntil && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Valid until</dt>
                <dd className="text-gray-700">{formatShortDate(proposal.validUntil)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-700">{formatShortDate(proposal.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {proposal.brief && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Brief
          </h3>
          <p className="whitespace-pre-line text-sm text-gray-700">{proposal.brief}</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Activity
          </h3>
          <ol className="flex flex-col gap-3">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 text-sm">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-300" />
                <div>
                  <span className="capitalize text-gray-700">{ev.type.replace(/_/g, " ")}</span>
                  <span className="ml-2 text-xs text-gray-400">{formatDayMonth(ev.createdAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {proposal.status === "Accepted" && !proposal.projectId && (
        <div className="rounded-xl border border-[#004DE7]/20 bg-[#004DE7]/5 p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Ready to build</h3>
          <p className="mb-4 text-sm text-gray-500">
            This proposal has been accepted. Convert it into a construction project to start
            tracking phases, milestones, and finances.
          </p>
          {ability.can("convert", "proposals") ? (
            <>
              {convert.error && (
                <p className="mb-3 text-xs text-red-600">
                  Conversion failed. Please try again.
                </p>
              )}
              <Button variant="primary" onClick={handleConvert} loading={convert.isPending}>
                Convert to project
              </Button>
            </>
          ) : (
            <p className="text-xs text-gray-400">
              Only owners and admins can convert proposals to projects.
            </p>
          )}
        </div>
      )}

      {proposal.projectId && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h3 className="mb-1 text-sm font-semibold text-green-800">Project created</h3>
          <p className="mb-4 text-sm text-green-700">
            This proposal has been converted to a construction project.
          </p>
          <Link
            to={`/project/${proposal.projectId}/overview`}
            onClick={() => localStorage.setItem("buildpanda:last-suite", "construction")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Go to project
          </Link>
        </div>
      )}
    </div>
  );
}
