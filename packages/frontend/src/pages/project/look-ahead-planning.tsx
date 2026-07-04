import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useMaterialsLookAhead } from "@/hooks/use-look-ahead";
import { useMaterialStock } from "@/hooks/use-materials-ledger";
import { STATUS_META } from "./materials/shared";
import type { LookAheadActivity } from "@/lib/project-types";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function ProjectLookAheadPlanning() {
  const { project } = useProjectContext();
  const { data: lookAhead, isLoading } = useMaterialsLookAhead(project.id, 4);
  const { data: stock = [] } = useMaterialStock(project.id);

  const lowStock = stock.filter((s) => s.lowStock);

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Materials", to: `/project/${project.id}/materials` },
          { label: "Look-ahead Planning" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Look-ahead Planning"
        description={`A rolling 4-week view of upcoming work${lookAhead ? ` (${formatDate(lookAhead.from)} – ${formatDate(lookAhead.to)})` : ""}, cross-referenced with the material orders linked to each activity.`}
      />

      {lowStock.length > 0 && (
        <section className="mt-8 rounded-[16px] border-none bg-[#FFF7ED] p-5">
          <p className="text-[13px] font-semibold text-[#9A5B13]">
            {lowStock.length} material{lowStock.length === 1 ? "" : "s"} running low
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((s) => (
              <Badge key={s.materialId} tone="warning" size="sm">
                {s.materialName}: {s.onHandQty} {s.unit}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : !lookAhead || lookAhead.activities.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="Nothing scheduled in the next 4 weeks"
            description="Activities with a planned start date in this window will show up here alongside their linked material orders."
          />
        ) : (
          lookAhead.activities.map((activity) => (
            <LookAheadCard key={activity.activityId} activity={activity} />
          ))
        )}
      </section>
    </div>
  );
}

function LookAheadCard({ activity }: { activity: LookAheadActivity }) {
  return (
    <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8]">
      <header className="flex flex-col gap-2 border-b border-[#EDEDED] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-black-500">{activity.activityName}</p>
            {activity.phaseName && (
              <Badge tone="neutral" size="sm">{activity.phaseName}</Badge>
            )}
          </div>
          <p className="text-[12px] text-black-300">
            {formatDate(activity.plannedStartAt)} – {formatDate(activity.plannedEndAt)} · Crew{" "}
            {activity.workerCountPlanned}
          </p>
        </div>
        {!activity.hasMaterialCoverage && (
          <Badge tone="danger" size="sm">No materials ordered</Badge>
        )}
      </header>

      <div className="flex flex-col divide-y divide-[#EDEDED]">
        {activity.materialOrders.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-black-300">
            No material orders linked to this activity yet.
          </p>
        ) : (
          activity.materialOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-medium text-black-500">
                  {order.quantity} {order.unit} · {order.materialName}
                </p>
                <p className="text-[12px] text-black-300">
                  {order.supplier ?? "No supplier set"} · Needed by {formatDate(order.neededBy)}
                </p>
              </div>
              <Badge tone={STATUS_META[order.status].tone} size="sm">
                {STATUS_META[order.status].label}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
