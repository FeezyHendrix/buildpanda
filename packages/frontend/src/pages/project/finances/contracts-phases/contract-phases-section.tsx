import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, Stage } from "@/lib/project-types";
import { formatPercent, percentOfContract, phaseTotals } from "./contract-model";
import { SheetHeading } from "./sheet-parts";

/**
 * The phases a contract prices, with a Total row. Clicking a phase pushes its
 * drawer on top of the contract's.
 */

const HEADER_CELL = "h-[35px] px-[24px] py-0 text-caption-m font-medium normal-case text-[#525252]";
const BODY_CELL = "whitespace-nowrap px-[24px] py-0 text-caption-l text-[#1E1E1E] tabular-nums";
/** Column widths as shares of the 788px sheet body. */
const COLUMN_WIDTHS = ["25.8%", "31.3%", "22.2%", "20.7%"] as const;

interface ContractPhasesSectionProps {
  phases: Stage[];
  contractTotal: number;
  currency: Currency;
  onOpenPhase: (stage: Stage) => void;
}

export function ContractPhasesSection({ phases, contractTotal, currency, onOpenPhase }: ContractPhasesSectionProps) {
  const totals = useMemo(() => phaseTotals(phases, contractTotal), [phases, contractTotal]);

  return (
    <section>
      <SheetHeading>Phases · {phases.length}</SheetHeading>
      {phases.length === 0 ? (
        <p className="mt-[18px] bg-[#F6F6F6] p-4 text-caption-l text-[#737373]">No phases priced under this contract yet.</p>
      ) : (
        <div className="mt-[9px] border border-[#EEEEEE]">
          <Table className="table-fixed">
            <colgroup>
              {COLUMN_WIDTHS.map((width) => (
                <col key={width} style={{ width }} />
              ))}
            </colgroup>
            <TableHead>
              <tr>
                <TableHeaderCell className={HEADER_CELL}>Build Stages</TableHeaderCell>
                <TableHeaderCell className={HEADER_CELL}>Scheduled value</TableHeaderCell>
                <TableHeaderCell className={HEADER_CELL}>% of contract</TableHeaderCell>
                <TableHeaderCell className={HEADER_CELL}>Est. costs</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id} onClick={() => onOpenPhase(phase)} className="h-[46px] border-[#EEEEEE]">
                  <TableCell className={`${BODY_CELL} truncate`}>{phase.name}</TableCell>
                  <TableCell className={BODY_CELL}>{formatCurrency(phase.value, currency)}</TableCell>
                  <TableCell className={BODY_CELL}>{formatPercent(percentOfContract(phase.value, contractTotal))}</TableCell>
                  <TableCell className={BODY_CELL}>
                    {phase.expectedCost == null ? "—" : formatCurrency(phase.expectedCost, currency)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow tone="total" className="h-[34px] border-[#EEEEEE] [&_td]:font-normal">
                <TableCell className="px-[24px] py-0 text-caption-m text-[#525252]">Total</TableCell>
                <TableCell className={`${BODY_CELL}`}>{formatCurrency(totals.scheduled, currency)}</TableCell>
                <TableCell className={`${BODY_CELL}`}>{formatPercent(totals.percent)}</TableCell>
                <TableCell className={`${BODY_CELL}`}>{formatCurrency(totals.estimatedCost, currency)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

ContractPhasesSection.displayName = "ContractPhasesSection";
