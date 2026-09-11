import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Factory that wraps `create` with devtools wired up consistently.
 * Every store gets named actions in the Redux DevTools without each slice
 * re-importing and re-configuring the middleware (DRY + Open/Closed).
 *
 *   export const useCounter = createStore<CounterState>(
 *     (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
 *     { name: "counter" },
 *   );
 */
export function createStore<T>(
  initializer: StateCreator<T, [["zustand/devtools", never]], []>,
  options?: { name?: string },
) {
  return create<T>()(
    devtools(initializer, {
      name: options?.name,
      enabled: process.env.NODE_ENV === "development",
    }),
  );
}
