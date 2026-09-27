import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSaveWorkbook, useWorkbook } from "@/hooks/use-workbook";
import { classifyWorkbookFailure, workbookApi } from "@/api/workbook";
import { buildCandidate, isSendable, type Candidate } from "./candidate";
import { candidateFingerprint, compareForConflict, type ConflictReport } from "./save-plan";
import type { SaveState } from "./workbook-toolbar";
import type { CellFocus, WorkbookContext, WorkbookEngine } from "./univer-engine";
import type { GuardRefusal } from "./univer-guards";
import type { WorkbookDocument, WorkbookLayout } from "@/api/workbook-types";

const EMPTY_LAYOUT: WorkbookLayout = { schemaVersion: 1, sheets: [] };

export interface WorkbookEditor {
  document: WorkbookDocument | undefined;
  loading: boolean;
  error: unknown;
  layout: () => WorkbookLayout;
  state: SaveState;
  focus: CellFocus | null;
  refusal: GuardRefusal | null;
  candidate: Candidate | null;
  conflict: ConflictReport | null;
  /** A newer document exists but a draft is in the grid, so it has NOT been applied. */
  heldBack: boolean;
  gridKey: number;
  attachEngine: (engine: WorkbookEngine) => void;
  engine: () => WorkbookEngine | null;
  markDirty: () => void;
  setFocus: (focus: CellFocus | null) => void;
  setRefusal: (refusal: GuardRefusal | null) => void;
  save: () => Promise<void>;
  clearRefusals: () => void;
  discardMine: () => void;
  keepMine: () => Promise<void>;
  rememberContext: () => void;
  restoreContext: () => void;
  /**
   * Rebuild the grid from a whole server document. Saved undo needs this:
   * patching only bound cells would leave the reversed edit on screen.
   */
  adoptWholeDocument: (fresh: WorkbookDocument) => void;
  failureMessage: string | null;
}

/**
 * The editor's whole rule set: when a draft exists, when it may be replaced,
 * and what a save does.
 *
 * The single invariant everything here serves: A DRAFT IS ONLY EVER DISCARDED
 * BY THE PERSON WHO MADE IT. A realtime frame, a colleague's save, a refetch
 * and a failed request all leave the grid exactly as it was. The only paths
 * that replace it are the user pressing "Discard mine" and a successful save
 * of their own work.
 */
export function useWorkbookEditor(sessionId: string, active: boolean): WorkbookEditor {
  const query = useWorkbook(sessionId, active);
  const save = useSaveWorkbook(sessionId);

  const engineRef = useRef<WorkbookEngine | null>(null);
  const contextRef = useRef<WorkbookContext | null>(null);
  /** The document the grid was built from. Not the latest one the server has. */
  const baseRef = useRef<WorkbookDocument | null>(null);

  const [dirty, setDirty] = useState(false);
  /**
   * Fingerprint of the untouched grid. Dirtiness is decided by comparing
   * against it, because mounting and calculating emit the same change events
   * typing does — trusting those alone reports "unsaved" on a fresh open.
   */
  const cleanRef = useRef<string | null>(null);
  const recheck = useRef<number | null>(null);
  const [focus, setFocus] = useState<CellFocus | null>(null);
  const [refusal, setRefusal] = useState<GuardRefusal | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [conflict, setConflict] = useState<ConflictReport | null>(null);
  const [heldBack, setHeldBack] = useState(false);
  /** Bumped to rebuild the grid from scratch. The only way to drop a draft wholesale. */
  const [gridKey, setGridKey] = useState(0);

  const base = baseRef.current;
  const document = base ?? query.data;

  const layout = useCallback((): WorkbookLayout => baseRef.current?.layout ?? EMPTY_LAYOUT, []);

  const adopt = useCallback((fresh: WorkbookDocument): void => {
    baseRef.current = fresh;
    setHeldBack(false);
  }, []);

  /** What the grid currently is, as the server would be asked to store it. */
  const fingerprintNow = useCallback((): string | null => {
    const engine = engineRef.current;
    const current = baseRef.current;
    if (!engine || !current) return null;
    const built = buildCandidate(engine.save(), current);
    return candidateFingerprint({
      expectedVersion: current.version,
      expectedSourceFingerprint: current.sourceFingerprint,
      snapshot: built.snapshot,
      rowPatches: built.rowPatches,
    });
  }, []);

  const attachEngine = useCallback(
    (engine: WorkbookEngine) => {
      engineRef.current = engine;
      cleanRef.current = null;
      if (contextRef.current) engine.restore(contextRef.current);
      // After the engine has settled its first calculation, whatever the grid
      // says IS the clean state.
      window.setTimeout(() => {
        cleanRef.current = fingerprintNow();
        setDirty(false);
      }, 400);
    },
    [fingerprintNow],
  );

  // A fresher document from the server — a realtime frame, a remeasure, a
  // colleague's save. It is written into the bound cells ONLY while the grid is
  // clean. With a draft open it is held back and announced, because patching
  // under someone's fingers is how a rebase quietly eats an afternoon.
  useEffect(() => {
    const fresh = query.data;
    if (!fresh) return;
    if (baseRef.current === null) {
      adopt(fresh);
      return;
    }
    if (fresh.version === baseRef.current.version && fresh.sourceFingerprint === baseRef.current.sourceFingerprint) {
      return;
    }
    if (dirty) {
      setHeldBack(true);
      return;
    }
    adopt(fresh);
    void engineRef.current?.applySourceCells(fresh).then(() => {
      // The measured figures moving is not an edit BY the user. Re-baseline, or
      // a remeasure they watched happen would leave the workbook claiming
      // unsaved changes they never made.
      cleanRef.current = fingerprintNow();
      setDirty(false);
    });
  }, [query.data, dirty, adopt, fingerprintNow]);

  const rememberContext = useCallback(() => {
    const captured = engineRef.current?.context();
    if (captured) contextRef.current = captured;
  }, []);

  const restoreContext = useCallback(() => {
    if (contextRef.current) engineRef.current?.restore(contextRef.current);
  }, []);

  const runSave = useCallback(
    async (force: boolean): Promise<void> => {
      const engine = engineRef.current;
      if (!engine || !baseRef.current) return;

      // "Keep mine" keeps MY CELLS, never my copy of a measured figure. Rebase
      // onto the fresh sources first (bound cells only, so the draft survives);
      // without it the pre-remeasure quantity is echoed back and refused 422.
      if (force) {
        const fresh = await workbookApi.get(sessionId);
        adopt(fresh);
        await engine.applySourceCells(fresh);
      }

      const current = baseRef.current;
      const built = buildCandidate(engine.save(), current);
      setCandidate(built);
      if (!isSendable(built)) return;

      const against = current;

      try {
        const result = await save.mutateAsync({
          expectedVersion: against.version,
          expectedSourceFingerprint: against.sourceFingerprint,
          snapshot: built.snapshot,
          ...(built.rowPatches.length > 0 ? { rowPatches: built.rowPatches } : {}),
        });
        adopt(result.document);
        setDirty(false);
        setConflict(null);
        setCandidate(null);
        await engine.applySourceCells(result.document);
        // What is on screen now is what the server holds, so that is the new
        // clean state to measure the next edit against.
        cleanRef.current = fingerprintNow();
      } catch (error) {
        // Reverting nothing is the point: the grid keeps everything typed, and
        // the held operation id makes a retry of this same work idempotent.
        if (classifyWorkbookFailure(error).kind !== "stale") return;
        const server = await workbookApi.get(sessionId);
        setConflict({ ...compareForConflict(built.snapshot, server), fromVersion: current.version });
      }
    },
    [adopt, save, sessionId, fingerprintNow],
  );

  const state: SaveState = useMemo(() => {
    if (save.isPending) return "saving";
    if (conflict !== null) return "conflict";
    if (candidate !== null && !isSendable(candidate)) return "failed";
    if (save.failure !== null) return "failed";
    return dirty ? "dirty" : "clean";
  }, [save.isPending, save.failure, conflict, candidate, dirty]);

  return {
    document,
    loading: query.isPending,
    error: query.error,
    layout,
    state,
    focus,
    refusal,
    candidate,
    conflict,
    heldBack,
    gridKey,
    attachEngine,
    // Stable: an effect that depends on reaching the engine must not re-run on
    // every render, or a command it issues re-renders and issues it again.
    engine: useCallback(() => engineRef.current, []),
    // Coalesced: one keystroke can emit several engine events, and each would
    // otherwise serialize the whole workbook to answer the same question.
    markDirty: useCallback(() => {
      setConflict(null);
      if (recheck.current !== null) window.clearTimeout(recheck.current);
      recheck.current = window.setTimeout(() => {
        const now = fingerprintNow();
        setDirty(cleanRef.current !== null && now !== null && now !== cleanRef.current);
      }, 150);
    }, [fingerprintNow]),
    setFocus,
    setRefusal,
    save: () => runSave(false),
    clearRefusals: useCallback(() => {
      setCandidate(null);
      save.abandonRetry();
    }, [save]),
    // A real discard, not a patch. `applySourceCells` only reaches the
    // generated half, so it could never remove a formula the user wrote in a
    // free column — the grid has to be rebuilt from the server's document.
    discardMine: useCallback(() => {
      const fresh = query.data;
      setDirty(false);
      setConflict(null);
      setCandidate(null);
      save.abandonRetry();
      if (fresh) adopt(fresh);
      setGridKey((key) => key + 1);
    }, [query.data, adopt, save]),
    keepMine: () => runSave(true),
    rememberContext,
    restoreContext,
    adoptWholeDocument: useCallback(
      (fresh: WorkbookDocument) => {
        rememberContext();
        adopt(fresh);
        setDirty(false);
        setConflict(null);
        setCandidate(null);
        setGridKey((key) => key + 1);
      },
      [adopt, rememberContext],
    ),
    failureMessage: save.failure?.message ?? null,
  };
}
