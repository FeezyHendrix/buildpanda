import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { PageHeader } from "@/components/molecules/page-header";
import { useContracts, useDeleteContract, type Contract } from "@/hooks/use-contracts";
import { useProjectFinances } from "@/hooks/use-finances";
import { useStages } from "@/hooks/use-stages";
import { useProjectContext } from "@/layouts/project-layout";
import { getApiErrorMessage } from "@/lib/api-error";
import { CONTRACTS_PHASES_TABS } from "@/lib/finance-routes";
import { canResourceAction, type Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { ContractDrawer, isContractView, type ContractView } from "./contracts-phases/contract-drawer";
import {
  contractOfStage,
  MAIN_CONTRACT_KEY,
  mainContractOf,
  matchesContractSearch,
  phasesOfContract,
  resolveMainContract,
} from "./contracts-phases/contract-model";
import { ContractsTable } from "./contracts-phases/contracts-table";
import { popEntry, pushEntry, topContractId, topPhaseId, type DrawerEntry } from "./contracts-phases/drawer-stack";
import { PhaseDrawer } from "./contracts-phases/phase-drawer";
import { PhasesTable } from "./contracts-phases/phases-table";
import { UpsertContractDialog } from "./contracts-phases/upsert-contract-dialog";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
import { ScheduleOfValuesDrawer } from "./schedule-of-values-drawer";
import { StageValueDrawer } from "./stage-value-drawer";

/**
 * Contracts & phases: the agreements that price this build and the phases
 * they price. `?drawer=main&view=final-account` opens the main contract on
 * its Final account section (where the old page used to be).
 */
export default function ProjectContractsPhasesPage() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canManageStages = canResourceAction(access, "stages", "manage");
  const currency = project.currency;
  const { tab, setTab, visible } = useFinanceTab(CONTRACTS_PHASES_TABS);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: contracts = [], isPending: contractsPending } = useContracts(project.id);
  const { data: stages = [], isPending: stagesPending } = useStages(project.id);
  const { data: finances } = useProjectFinances(project.id);
  const deleteContract = useDeleteContract();

  const [search, setSearch] = useState("");
  const [stack, setStack] = useState<DrawerEntry[]>([]);
  const [view, setView] = useState<ContractView>("details");
  const [upsert, setUpsert] = useState<{ open: boolean; initial: Contract | null }>({ open: false, initial: null });
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [valueTarget, setValueTarget] = useState<Stage | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Stage | null>(null);

  const mainContract = useMemo(() => resolveMainContract(contracts, finances, stages), [contracts, finances, stages]);
  const mainId = mainContractOf(contracts)?.id;
  // The placeholder main contract is listed until the API knows about one.
  const listed = useMemo(
    () => (mainContractOf(contracts) ? contracts : [mainContract, ...contracts]),
    [contracts, mainContract],
  );
  const query = search.trim().toLowerCase();
  const visibleContracts = useMemo(() => listed.filter((c) => matchesContractSearch(c, query)), [listed, query]);
  const visibleStages = useMemo(
    () => (query ? stages.filter((stage) => stage.name.toLowerCase().includes(query)) : stages),
    [stages, query],
  );

  // Deep link: ?drawer=<contractId|main>&view=<section>, consumed once.
  useEffect(() => {
    const drawer = searchParams.get("drawer");
    if (!drawer) return;
    const wanted = searchParams.get("view");
    setView(isContractView(wanted) ? wanted : "details");
    setStack([{ kind: "contract", contractId: drawer === MAIN_CONTRACT_KEY ? MAIN_CONTRACT_KEY : drawer }]);
    searchParams.delete("drawer");
    searchParams.delete("view");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openContract = useCallback((contract: Contract) => {
    setView("details");
    setStack([{ kind: "contract", contractId: contract.id }]);
  }, []);
  const pushPhase = useCallback((stage: Stage) => setStack((current) => pushEntry(current, { kind: "phase", stageId: stage.id })), []);
  const pop = useCallback(() => setStack((current) => popEntry(current)), []);

  const contractId = topContractId(stack);
  const openedContract =
    contractId === MAIN_CONTRACT_KEY || contractId === mainId
      ? mainContract
      : (listed.find((contract) => contract.id === contractId) ?? null);
  const phaseId = topPhaseId(stack);
  const openedPhase = phaseId ? (stages.find((stage) => stage.id === phaseId) ?? null) : null;
  const contractPhases = useMemo(
    () => (openedContract ? phasesOfContract(openedContract, stages, mainId) : []),
    [openedContract, stages, mainId],
  );

  function handleDelete(): void {
    if (!deleteTarget) return;
    deleteContract.mutate(
      { projectId: project.id, contractId: deleteTarget.id },
      {
        onSuccess: () => {
          toast("Contract deleted", "success");
          setDeleteTarget(null);
          setStack([]);
        },
        onError: (error) => toast(getApiErrorMessage(error, "Could not delete the contract"), "error"),
      },
    );
  }

  return (
    <FinancePageFrame>
      <PageHeader title="Contracts & phases" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Contract sections" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full rounded-lg bg-surface-alt sm:max-w-xs">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tab === "contracts" ? "Search contracts" : "Search by phase"}
            aria-label={tab === "contracts" ? "Search contracts" : "Search phases"}
          />
        </div>
        {tab === "contracts" && canManage ? (
          <Button variant="primary" size="md" onClick={() => setUpsert({ open: true, initial: null })}>
            <PlusIcon className="size-4" />
            Add contract
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {tab === "contracts" ? (
          <ContractsTable
            projectId={project.id}
            currency={currency}
            contracts={visibleContracts}
            isLoading={contractsPending}
            isFiltered={query.length > 0}
            canManage={canManage}
            onView={openContract}
            onEdit={(contract) => setUpsert({ open: true, initial: contract })}
            onDelete={setDeleteTarget}
            onAdd={() => setUpsert({ open: true, initial: null })}
          />
        ) : (
          <PhasesTable
            projectId={project.id}
            currency={currency}
            stages={visibleStages}
            contracts={contracts}
            mainContract={mainContract}
            isLoading={stagesPending}
            isFiltered={query.length > 0}
            canManage={canManageStages}
            onView={(stage) => setStack([{ kind: "phase", stageId: stage.id }])}
            onEditValue={setValueTarget}
            onOpenSchedule={setScheduleTarget}
          />
        )}
      </div>

      {openedContract ? (
        <ContractDrawer
          open
          onOpenChange={(next) => {
            if (!next) setStack([]);
          }}
          projectId={project.id}
          contract={openedContract}
          phases={contractPhases}
          currency={currency}
          canManage={canManage}
          view={view}
          onViewChange={setView}
          onEdit={(contract) => setUpsert({ open: true, initial: contract })}
          onOpenPhase={pushPhase}
        />
      ) : null}

      {openedPhase ? (
        <PhaseDrawer
          open
          onOpenChange={(next) => {
            if (!next) pop();
          }}
          projectId={project.id}
          stage={openedPhase}
          contract={contractOfStage(openedPhase, contracts, mainContract)}
          currency={currency}
          canManage={canManageStages}
          stacked={stack.length > 1}
          onEditValue={setValueTarget}
          onOpenSchedule={setScheduleTarget}
        />
      ) : null}

      <UpsertContractDialog
        open={upsert.open}
        onOpenChange={(next) => setUpsert((current) => ({ ...current, open: next }))}
        projectId={project.id}
        currency={currency}
        initial={upsert.initial}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={deleteTarget ? `Delete ${deleteTarget.title}?` : "Delete contract?"}
        description="Its phases keep their values but no longer point at this contract."
        confirmLabel="Delete contract"
        variant="danger"
        loading={deleteContract.isPending}
        onConfirm={handleDelete}
      />

      <StageValueDrawer
        open={valueTarget !== null}
        onOpenChange={(next) => {
          if (!next) setValueTarget(null);
        }}
        projectId={project.id}
        stage={valueTarget}
        currency={currency}
      />

      <ScheduleOfValuesDrawer
        open={scheduleTarget !== null}
        onOpenChange={(next) => {
          if (!next) setScheduleTarget(null);
        }}
        projectId={project.id}
        stage={scheduleTarget}
        currency={currency}
        canManage={canManageStages}
      />
    </FinancePageFrame>
  );
}
