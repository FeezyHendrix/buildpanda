// Query keys for the take-off (pre-construction) surface: sessions and their
// snapshot, the editor's audit history, Panda AI assist, sheet markups,
// assemblies, presence and the estimate link. Split out of `query-keys` so
// neither file outgrows a single reader; `query-keys` re-exports every name
// here, so call sites import from there as before.

export const preconKeys = {
  all: ["precon"] as const,
  sessions: () => [...preconKeys.all, "sessions"] as const,
  snapshot: (sessionId: string) => [...preconKeys.all, "snapshot", sessionId] as const,
  programme: (sessionId: string) => [...preconKeys.all, "programme", sessionId] as const,
  progressFeed: (sessionId: string) => [...preconKeys.all, "progress-feed", sessionId] as const,
  snap: (sheetId: string) => [...preconKeys.all, "snap", sheetId] as const,
};

// NOT nested under the snapshot key. The workbook and the bill go stale
// independently — a formula edit moves one and not the other — and nesting
// would make every measurement refetch throw away a grid the user is typing in.
export const workbookKeys = {
  all: ["precon", "workbook"] as const,
  document: (sessionId: string) => [...workbookKeys.all, sessionId] as const,
  history: (sessionId: string) => [...workbookKeys.all, sessionId, "history"] as const,
};

// Nested under the snapshot key on purpose: an edit and the history of edits
// go stale together, so one invalidation covers both.
export const editorKeys = {
  history: (sessionId: string, sheetId?: string) =>
    [...preconKeys.snapshot(sessionId), "editor-history", sheetId ?? ""] as const,
};

export const preconAssistKeys = {
  all: ["precon-assist"] as const,
  forSession: (sessionId: string) => [...preconAssistKeys.all, "session", sessionId] as const,
};


export const takeoffLinkKeys = {
  lineStatuses: (sessionId: string) => ["precon", "line-statuses", sessionId] as const,
};

export const rateLibraryKeys = {
  all: ["rate-library"] as const,
  cards: () => [...rateLibraryKeys.all, "cards"] as const,
  quotes: () => [...rateLibraryKeys.all, "quotes"] as const,
};



// WS-9: proposal-scoped safety pack (risk register, method statements, phase plan)
export const preconSafetyKeys = {
  all: (proposalId: string) => ["proposals", proposalId, "safety"] as const,
  risks: (proposalId: string) => [...preconSafetyKeys.all(proposalId), "risks"] as const,
  statements: (proposalId: string) => [...preconSafetyKeys.all(proposalId), "method-statements"] as const,
  phasePlan: (proposalId: string) => [...preconSafetyKeys.all(proposalId), "phase-plan"] as const,
};

// WS-M1D: pinned comments on take-off sheets (drawing-markup register, precon anchor)
export const preconMarkupKeys = {
  all: ["precon", "markups"] as const,
  session: (sessionId: string) => [...preconMarkupKeys.all, sessionId] as const,
};

// WS-M3B: assemblies in the rate library, and who is on a take-off session
export const preconAssemblyKeys = {
  all: ["precon", "assemblies"] as const,
  list: () => [...preconAssemblyKeys.all, "list"] as const,
};

export const preconPresenceKeys = {
  all: ["precon", "presence"] as const,
  session: (sessionId: string) => [...preconPresenceKeys.all, sessionId] as const,
};
