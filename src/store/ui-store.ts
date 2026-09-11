import { createStore } from "./create-store";

type Theme = "light" | "dark" | "system";

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  parameterPanelOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleParameterPanel: () => void;
  setParameterPanelOpen: (open: boolean) => void;
}

/**
 * Example global UI store. Keep stores small and feature-scoped; compose
 * additional slices rather than growing one mega-store (Single Responsibility).
 */
export const useUiStore = createStore<UiState>(
  (set) => ({
    theme: "system",
    sidebarOpen: true,
    parameterPanelOpen: true,
    setTheme: (theme) => set({ theme }, false, "ui/setTheme"),
    toggleSidebar: () =>
      set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, "ui/toggleSidebar"),
    setSidebarOpen: (sidebarOpen) =>
      set({ sidebarOpen }, false, "ui/setSidebarOpen"),
    toggleParameterPanel: () =>
      set(
        (s) => ({ parameterPanelOpen: !s.parameterPanelOpen }),
        false,
        "ui/toggleParameterPanel",
      ),
    setParameterPanelOpen: (parameterPanelOpen) =>
      set({ parameterPanelOpen }, false, "ui/setParameterPanelOpen"),
  }),
  { name: "ui-store" },
);

// Atomic selectors — import these to subscribe to a single slice and avoid
// unnecessary re-renders.
export const selectTheme = (s: UiState) => s.theme;
export const selectSidebarOpen = (s: UiState) => s.sidebarOpen;
export const selectParameterPanelOpen = (s: UiState) => s.parameterPanelOpen;
