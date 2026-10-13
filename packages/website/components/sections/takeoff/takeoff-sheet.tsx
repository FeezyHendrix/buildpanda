import { takeoff } from "@/content/takeoff";
import { cn } from "@/lib/cn";

const TITLE_ID = "takeoff-sheet-title";
type Row = (typeof takeoff.sheet.rows)[number] | (typeof takeoff.sheet.found)[number];

function SheetRow({ row }: { row: Row }) {
  return (
    <tr className="sheet-row">
      <th scope="row" className="px-4 text-left font-normal">
        {row.item}
      </th>
      <td className="px-4 text-right whitespace-nowrap">
        <span className="font-semibold tabular-nums">{row.quantity}</span>
        <abbr title={row.unitName} className="ml-1 text-[0.6875rem] text-white/70 no-underline">
          {row.unit}
        </abbr>
      </td>
    </tr>
  );
}

/**
 * The generated takeoff sheet. Six rows show; the list scrolls up behind the
 * header one row at a time as two more rows are found, then scrolls back to
 * the start, on a loop (see `.sheet-track`). The drawing card pins its
 * callouts on the same clock.
 */
export function TakeoffSheet({ className }: { className?: string }) {
  const { sheet } = takeoff;

  return (
    <div className={cn("bg-brand text-white", className)}>
      <div className="flex h-11 items-center justify-between gap-4 bg-white/10 px-4">
        <p id={TITLE_ID} className="text-[0.8125rem] text-white/80">
          {sheet.title}
        </p>
        <p className="rounded-full bg-signal px-2 py-0.5 text-[0.6875rem] font-bold text-ink">{sheet.count}</p>
      </div>

      <div className="sheet-window">
        <table aria-labelledby={TITLE_ID} className="sheet-track w-full text-[0.9375rem]">
          <tbody>
            {sheet.rows.map((row) => (
              <SheetRow key={row.item} row={row} />
            ))}
            {sheet.found.map((row) => (
              <SheetRow key={row.item} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-white/12 px-4 py-3 text-[0.8125rem] text-white/70">{sheet.more}</p>
    </div>
  );
}
