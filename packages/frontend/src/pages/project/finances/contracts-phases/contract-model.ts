import type { BadgeTone } from "@/components/atoms/badge";
import type { Contract, ContractStatus } from "@/api/contracts";
import { Money } from "@/lib/money";
import type { ProjectFinances, Stage } from "@/lib/project-types";

/**
 * Pure helpers for Contracts & phases. A contract is a signed commercial
 * record; the main one is priced by the project's contract sum, a change-order
 * one by the change request it executes. Phases point at the contract that
 * prices them.
 */

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; tone: BadgeTone; marker: string }> = {
  Draft: { label: "Draft", tone: "neutral", marker: "○" },
  Pending: { label: "Pending", tone: "warning", marker: "◔" },
  Signed: { label: "Signed", tone: "success", marker: "●" },
};

export const SIGNED_NEEDS_DOCUMENT = "Attach the signed contract document before marking it Signed";

export const CONTRACT_KIND_LABEL: Record<Contract["kind"], string> = {
  main: "Main contract",
  change_order: "Change order",
};

/** Id the main contract is addressed by in the URL (`?drawer=main`) before the API has one. */
export const MAIN_CONTRACT_KEY = "main";

export function mainContractOf(contracts: Contract[]): Contract | undefined {
  return contracts.find((contract) => contract.kind === "main");
}

/**
 * The main contract as the page shows it: the API's record when it exists,
 * otherwise a placeholder priced from the project's contract sum, so Terms
 * and Final account stay reachable before the contracts endpoint is live.
 */
export function resolveMainContract(contracts: Contract[], finances: ProjectFinances | undefined, stages: Stage[]): Contract {
  const existing = mainContractOf(contracts);
  if (existing) return existing;
  return {
    id: MAIN_CONTRACT_KEY,
    kind: "main",
    changeRequestId: null,
    title: "Main contract",
    trade: null,
    legalEntity: null,
    total: finances?.contractSum ?? 0,
    status: "Draft",
    signedAt: null,
    documentId: null,
    documentName: null,
    phaseCount: stages.filter((stage) => !stage.contractId).length,
    createdAt: "",
  };
}

export function isPlaceholderContract(contract: Contract): boolean {
  return contract.id === MAIN_CONTRACT_KEY;
}

/** Phases priced by a contract; unassigned phases belong to the main contract. */
export function phasesOfContract(contract: Contract, stages: Stage[], mainId: string | undefined): Stage[] {
  if (contract.kind === "main") {
    return stages.filter((stage) => !stage.contractId || stage.contractId === mainId || stage.contractId === contract.id);
  }
  return stages.filter((stage) => stage.contractId === contract.id);
}

export function contractOfStage(stage: Stage, contracts: Contract[], main: Contract): Contract {
  const found = stage.contractId ? contracts.find((contract) => contract.id === stage.contractId) : undefined;
  return found ?? main;
}

export function percentOfContract(value: number, contractTotal: number): number | null {
  if (contractTotal <= 0) return null;
  return Money.of(value).div(contractTotal).mul(100).round(2).toNumber();
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

export interface PhaseTotals {
  scheduled: number;
  percent: number | null;
  estimatedCost: number;
}

export function phaseTotals(phases: Stage[], contractTotal: number): PhaseTotals {
  const scheduled = Money.sum(phases.map((phase) => phase.value)).round(2).toNumber();
  return {
    scheduled,
    percent: percentOfContract(scheduled, contractTotal),
    estimatedCost: Money.sum(phases.map((phase) => phase.expectedCost ?? 0)).round(2).toNumber(),
  };
}

/** What a typed estimate means: empty clears it, anything else must be a non-negative number. */
export function parseEstimate(raw: string): number | null | "invalid" {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return "invalid";
  return Math.round(value * 100) / 100;
}

export function matchesContractSearch(contract: Contract, query: string): boolean {
  if (!query) return true;
  return [contract.title, contract.trade, contract.legalEntity].filter(Boolean).join(" ").toLowerCase().includes(query);
}

export function formatSignedDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
