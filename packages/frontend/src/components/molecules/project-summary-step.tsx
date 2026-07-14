import { useState, useRef, useEffect } from "react";
import type { ProjectType } from "./project-type-step";
import { PROJECT_TYPE_OPTIONS } from "./project-type-step";
import type { InvolvementLevel, RiskOption } from "./management-step";
import { INVOLVEMENT_OPTIONS, RISK_OPTIONS_CONFIG } from "./management-step";
import {
  FUNDING_METHODS,
  TIMELINES,
  buildingTypesForProjectType,
  timelineOptionsForProjectType,
} from "./project-details-step";
import { Button } from "@/components/atoms";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import logo from "@/assets/images/logo.svg";

interface ProjectSummaryData {
  projectTitle: string;
  projectType: ProjectType | null;
  locationState: string | null;
  city: string;
  buildingType: string | null;
  currency: string;
  budget: [number, number];
  timeline: string | null;
  fundingMethod: string | null;
  involvementLevel: InvolvementLevel | null;
  riskOptions: RiskOption[];
}

interface ProjectSummaryStepProps {
  data: ProjectSummaryData;
  onEdit: (step: number) => void;
  onStart: () => void;
  isStarting?: boolean;
  hideManagement?: boolean;
}

function resolveLabel(
  list: readonly { id: string; title: string }[],
  id: string | null,
): string {
  if (!id) return "-";
  return list.find((item) => item.id === id)?.title ?? "-";
}

function formatBudget(currency: string, range: [number, number]): string {
  return `${formatCurrency(range[0], currency, { whole: true })} – ${formatCurrency(range[1], currency, { whole: true })}`;
}

const PHASES = [
  {
    title: "Site Survey & Soil Testing",
    duration: "Expected: 2 Weeks",
    description: "Required for foundation integrity and structural design.",
  },
  {
    title: "Permitting & Approvals",
    duration: "Expected: 4–6 Weeks",
    description:
      "Includes LASBCA documentation and environmental clearance.",
  },
  {
    title: "Foundation & Substructure",
    duration: "Expected: 8 Weeks",
    description: "Critical path milestone for structural stability.",
  },
  {
    title: "Superstructure & Finishing",
    duration: "Expected: 20–24 Weeks",
    description: "Final architectural and utility installations.",
  },
];

const DOCUMENTS = [
  "Certificate of Ownership",
  "Environmental Impact Assessment",
  "Building Plan Approval (LASPPPA)",
];

const PDF_PAGE_HEIGHT = 842;

function BlueprintPage({
  data,
  pageIndex,
  hideManagement = false,
}: {
  data: ProjectSummaryData;
  pageIndex: number;
  hideManagement?: boolean;
}) {
  const buildingTypes = buildingTypesForProjectType(data.projectType);
  const timelineOptions = timelineOptionsForProjectType(data.projectType);
  const timelineLabel =
    timelineOptions.find((t) => t.id === data.timeline)?.label ??
    TIMELINES.find((t) => t.id === data.timeline)?.label ??
    "-";
  const locationText = [data.city, data.locationState]
    .filter(Boolean)
    .join(", ");

  if (pageIndex === 0) {
    return (
      <div className="space-y-0">
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <img src={logo} alt="BuildPanda" className="h-6 lg:h-8" />
          <div className="flex-1 text-right">
            <h2 className="text-sm lg:text-xl font-bold text-black-500 text-balance">
              Your Project Blueprint
            </h2>
            <p className="mt-1 text-xs text-gray-500 text-pretty">
              AI-powered analysis and strategic roadmap for
            </p>
            {(data.projectTitle || locationText) && (
              <p className="mt-0.5 text-xs">
                <span className="font-medium text-[#004DE7]">
                  {data.projectTitle}
                  {locationText ? ` at ${locationText}` : ""}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b border-gray-200 py-6 sm:grid-cols-2 sm:gap-6">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">
              Estimated Cost Range
            </p>
            <p className="text-base font-bold text-gray-900 sm:text-lg">
              {formatBudget(data.currency, data.budget)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">
              Estimated Timeline
            </p>
            <p className="text-base font-bold text-gray-900 sm:text-lg">{timelineLabel}</p>
          </div>
        </div>

        <div className="border-b border-gray-200 py-6">
          <h3 className="mb-3 text-sm font-bold text-gray-900">
            Uploaded Documents
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {DOCUMENTS.map((doc) => (
              <div key={doc} className="flex items-start gap-2">
                <span className="mt-0.5 text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-700">{doc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6">
          <h3 className="mb-4 text-sm font-bold text-gray-900">
            Project Roadmap
          </h3>
          <div className="space-y-4">
            {PHASES.map((phase, idx) => (
              <div key={phase.title} className="flex gap-4">
                <p className="min-w-[50px] text-xs font-semibold text-gray-900">
                  Phase {idx + 1}
                </p>
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-gray-900">
                    {phase.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {phase.duration}
                  </p>
                  <p className="text-xs text-gray-500">{phase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <img src={logo} alt="BuildPanda" className="h-6" />
        <span className="text-xs text-gray-400">
          {data.projectTitle} (continued)
        </span>
      </div>

      <div className="py-6">
        <h3 className="mb-4 text-sm font-bold text-gray-900">
          Project Summary
        </h3>
        <div className="space-y-3">
          <SummaryLine
            label="Project Type"
            value={
              PROJECT_TYPE_OPTIONS.find((o) => o.type === data.projectType)
                ?.title ?? "-"
            }
          />
          <SummaryLine label="Location" value={locationText || "-"} />
          <SummaryLine
            label={data.projectType === "renovate" ? "Renovation Type" : "Building Type"}
            value={resolveLabel(buildingTypes, data.buildingType)}
          />
          <SummaryLine
            label="Budget"
            value={formatBudget(data.currency, data.budget)}
          />
          <SummaryLine label="Timeline" value={timelineLabel} />
          <SummaryLine
            label="Funding"
            value={resolveLabel(FUNDING_METHODS, data.fundingMethod)}
          />
          {!hideManagement && (
            <SummaryLine
              label="Involvement"
              value={resolveLabel(INVOLVEMENT_OPTIONS, data.involvementLevel)}
            />
          )}
          {!hideManagement && (
            <SummaryLine
              label="Risk Protection"
              value={
                data.riskOptions
                  .filter((r) => r.enabled)
                  .map(
                    (r) =>
                      RISK_OPTIONS_CONFIG.find((c) => c.id === r.id)?.title,
                  )
                  .filter(Boolean)
                  .join(", ") || "None selected"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-gray-100 pb-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-right text-xs font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ProjectSummaryStep({ data, onEdit, onStart, isStarting = false, hideManagement = false }: ProjectSummaryStepProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    const height = contentRef.current.scrollHeight;
    setTotalPages(Math.max(1, Math.ceil(height / PDF_PAGE_HEIGHT)));
  }, [data]);

  const pages = Array.from({ length: Math.max(totalPages, 2) }, (_, i) => i);

  return (
    <div className="flex flex-col gap-6 px-0 py-2 lg:flex-row lg:gap-10 lg:px-8 lg:py-4">

      {/* Mobile-only: page tabs + download above the blueprint */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex w-full gap-2">
          {pages.map((pageIdx) => (
            <button
              key={pageIdx}
              type="button"
              onClick={() => setActivePage(pageIdx)}
              className={cn(
                "block w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activePage === pageIdx
                  ? "bg-[#F6F6F6] text-gray-900"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Page {pageIdx + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-end gap-1.5 text-sm font-medium text-[#004DE7] hover:opacity-80"
          onClick={() => window.print()}
        >
          <DownloadIcon />
          Download PDF
        </button>
      </div>

      {/* Blueprint preview */}
      <div className="w-full lg:w-[60%] lg:shrink-0">
        <div className="overflow-x-auto">
          <div
            ref={contentRef}
            className="min-w-[300px] rounded-sm border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:p-8"
            style={{ minHeight: PDF_PAGE_HEIGHT }}
          >
            <BlueprintPage data={data} pageIndex={activePage} hideManagement={hideManagement} />
          </div>
        </div>
      </div>

      {/* Sidebar — desktop only for page nav + download; CTA always visible */}
      <div className="flex w-full flex-col lg:flex-1 lg:items-center lg:justify-center lg:py-4">
        <div className="w-full lg:max-w-sm">
          {/* Page tabs + download — desktop only */}
          <div className="hidden lg:block">
            <div className="mb-6 space-y-1">
              {pages.map((pageIdx) => (
                <button
                  key={pageIdx}
                  type="button"
                  onClick={() => setActivePage(pageIdx)}
                  className={cn(
                    "block w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors",
                    activePage === pageIdx
                      ? "bg-[#F6F6F6] text-gray-900"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  Page {pageIdx + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mb-8 flex w-full items-center justify-end gap-2 text-sm font-medium text-[#004DE7] hover:opacity-80"
              onClick={() => window.print()}
            >
              <DownloadIcon />
              Download PDF
            </button>
            <hr className="mb-8 border-gray-200" />
          </div>

          <div className="space-y-5 lg:space-y-6">
            <div>
              <h2 className="text-[22px] font-bold text-balance text-gray-900 lg:text-[25px]">
                Ready to break ground?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-gray-500 lg:mt-3">
                Our team is ready to bring your project to life. Review your
                blueprint and kick off construction when you're ready.
              </p>
            </div>

            <div className="space-y-3">
              <Button className="w-full" onClick={onStart} disabled={isStarting}>
                {isStarting ? "Creating…" : "Start Your Project"}
              </Button>
              <Button
                variant="ghost"
                className="w-full border border-[#004DE7] text-[#004DE7] hover:bg-[#004DE7]/5"
                onClick={() => onEdit(1)}
              >
                Modify Blueprint
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ProjectSummaryStep.displayName = "ProjectSummaryStep";

export {
  ProjectSummaryStep,
  type ProjectSummaryStepProps,
  type ProjectSummaryData,
};
