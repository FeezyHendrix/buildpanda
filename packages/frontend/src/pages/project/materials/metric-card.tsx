import { Card } from "@/components/atoms/card";

export function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card padding="md" className="bg-[#F8F8F8] rounded-[1px] border-none p-5">
      <p className="text-[12px] font-medium text-black-300">{label}</p>
      <p className="mt-2 text-[20px] font-semibold tabular-nums text-black-500">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-black-300">{helper}</p>
    </Card>
  );
}
