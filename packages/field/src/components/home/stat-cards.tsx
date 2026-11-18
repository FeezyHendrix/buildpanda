import { router } from "@/navigation";
import { Card, Text, type TextTone } from "@/components/atoms";
export interface Stat {
    key: string;
    label: string;
    value: string;
    detail: string;
    href: string;
    tone?: TextTone;
}
/** Numbers that need attention today, each opening the tool behind it. */
export function StatCards({ stats }: {
    stats: readonly Stat[];
}) {
    if (stats.length === 0)
        return null;
    return (<div className="field-stack flex-row flex-wrap gap-3">
      {stats.map((stat) => (<button key={stat.key} role="button" aria-label={`${stat.label}: ${stat.value}, ${stat.detail}`} onClick={() => router.push(stat.href as never)} className="min-w-[40%] flex-1 basis-[45%]" type="button">
          <Card className="min-h-24 p-4">
            <Text tone="secondary" weight="semibold" className="text-xs">{stat.label}</Text>
            <Text variant="heading" weight="bold" tone={stat.tone} className="pt-1 text-3xl">{stat.value}</Text>
            <Text tone="secondary" className="text-xs" numberOfLines={1}>{stat.detail}</Text>
          </Card>
        </button>))}
    </div>);
}
