import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { DrawerSectionTitle } from "../finance-drawer";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, Stage } from "@/lib/project-types";
import { formatPercent, percentOfContract, phaseTotals } from "./contract-model";

/**
 * The phases a contract prices, with a TOTALS row. Clicking a phase pushes its
 * drawer on top of the contract's.
 */

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
      <DrawerSectionTitle>Phases · {phases.length}</DrawerSectionTitle>
      {phases.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">No phases priced under this contract yet.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-line-hair">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell className="px-4">Phase</TableHeaderCell>
                <TableHeaderCell align="right" className="px-4">Scheduled value</TableHeaderCell>
                <TableHeaderCell align="right" className="px-4">% of contract</TableHeaderCell>
                <TableHeaderCell align="right" className="px-4">Est. costs</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id} onClick={() => onOpenPhase(phase)}>
                  <TableCell className="px-4 font-medium text-ink">{phase.name}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">{formatCurrency(phase.value, currency)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">
                    {formatPercent(percentOfContract(phase.value, contractTotal))}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">
                    {phase.expectedCost == null ? "—" : formatCurrency(phase.expectedCost, currency)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow tone="total">
                <TableCell className="px-4">Totals</TableCell>
                <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">{formatCurrency(totals.scheduled, currency)}</TableCell>
                <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">{formatPercent(totals.percent)}</TableCell>
                <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">{formatCurrency(totals.estimatedCost, currency)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

ContractPhasesSection.displayName = "ContractPhasesSection";
