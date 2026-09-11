import { createStore } from "@/store";


/** Max products that can be compared side-by-side at once. */
export const MAX_COMPARE = 4;

interface CatalogNavState {
  /** Expanded category ids in the tree. */
  expanded: Record<string, boolean>;
  /** Product (tree node) ids queued for comparison, in insertion order. */
  compareIds: string[];
  /** Whether the comparison overlay is open. */
  compareOpen: boolean;

  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, open: boolean) => void;
  /** Expand every id in a path (used to reveal the active node). */
  expandPath: (ids: string[]) => void;

  /** Add/remove a product from the comparison set (capped at MAX_COMPARE). */
  toggleCompare: (id: string) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;
  openCompare: () => void;
  closeCompare: () => void;
}

/**
 * Catalog tree chrome — purely which categories are open + the compare counter.
 *
 * Navigation (active node), the open tab, configuration selections and the
 * calculation operating point all live in the URL (see {@link useCatalogParams})
 * so they survive a refresh; this store holds only ephemeral, non-shareable tree
 * UI state. Expansion is re-derived from the active node's path on load, so a
 * reloaded URL still reveals its node in the tree.
 */
export const useCatalogStore = createStore<CatalogNavState>(
  (set) => ({
    expanded: {},
    compareIds: [],
    compareOpen: false,

    toggleExpanded: (id) =>
      set(
        (s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } }),
        false,
        "catalog/toggleExpanded",
      ),

    setExpanded: (id, open) =>
      set(
        (s) => ({ expanded: { ...s.expanded, [id]: open } }),
        false,
        "catalog/setExpanded",
      ),

    expandPath: (ids) =>
      set(
        (s) => ({
          expanded: ids.reduce(
            (acc, id) => {
              acc[id] = true;
              return acc;
            },
            { ...s.expanded },
          ),
        }),
        false,
        "catalog/expandPath",
      ),

    toggleCompare: (id) =>
      set(
        (s) => {
          if (s.compareIds.includes(id)) {
            return { compareIds: s.compareIds.filter((x) => x !== id) };
          }
          // Ignore additions past the cap so the table stays readable.
          if (s.compareIds.length >= MAX_COMPARE) return {};
          return { compareIds: [...s.compareIds, id] };
        },
        false,
        "catalog/toggleCompare",
      ),

    removeCompare: (id) =>
      set(
        (s) => ({ compareIds: s.compareIds.filter((x) => x !== id) }),
        false,
        "catalog/removeCompare",
      ),

    clearCompare: () =>
      set(
        { compareIds: [], compareOpen: false },
        false,
        "catalog/clearCompare",
      ),

    openCompare: () => set({ compareOpen: true }, false, "catalog/openCompare"),
    closeCompare: () =>
      set({ compareOpen: false }, false, "catalog/closeCompare"),
  }),
  { name: "catalog-store" },
);
