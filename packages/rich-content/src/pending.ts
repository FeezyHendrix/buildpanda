/** Prevent a form from committing before its selected image has been attached. */
let pending = 0;
const listeners = new Set<() => void>();
export const contentWork = {
  getSnapshot: () => pending > 0,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  begin() {
    pending += 1;
    listeners.forEach((listener) => listener());
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      pending -= 1;
      listeners.forEach((listener) => listener());
    };
  },
};
