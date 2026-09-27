import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

export function useFormExit(open: boolean, submitting: boolean, onClose: () => void, options: { dirty?: boolean; onDiscard?: () => void } = {}) {
  const [changed, setChanged] = useState(false);
  const dirty = options.dirty ?? changed;
  const allowExit = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const protectedDraft = open && dirty && !submitting;
  const blocker = useBlocker(useCallback(() => protectedDraft && !allowExit.current, [protectedDraft]));

  useEffect(() => { if (!open) setChanged(false); }, [open]);
  useEffect(() => {
    if (!protectedDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [protectedDraft]);

  function close() {
    if (submitting) return;
    if (dirty) setConfirming(true);
    else onClose();
  }

  function discard() {
    allowExit.current = true;
    options.onDiscard?.();
    setChanged(false);
    setConfirming(false);
    if (blocker.state === "blocked") blocker.proceed();
    else onClose();
  }

  function keepEditing() {
    setConfirming(false);
    if (blocker.state === "blocked") blocker.reset();
  }

  return { close, discard, keepEditing, markDirty: () => setChanged(true), confirming: confirming || blocker.state === "blocked" };
}
