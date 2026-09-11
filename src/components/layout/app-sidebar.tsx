"use client";

import { GitCompareArrows, PackageSearch, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Input } from "@/components/ui";
import {
  type CatalogNode,
  filterCatalog,
  useCatalogParams,
  useCatalogStore,
  useCatalogTree,
} from "@/features/catalog";
import { useIsMobile } from "@/hooks";
import { cn } from "@/lib/utils";
import { selectSidebarOpen, useUiStore } from "@/store";
import { AppSidebarTree } from "./app-sidebar-tree";

export function AppSidebar() {
  const open = useUiStore(selectSidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const isMobile = useIsMobile();

  const { data: tree = [], isLoading, isError, refetch } = useCatalogTree();
  const compareCount = useCatalogStore((s) => s.compareIds.length);
  const openCompare = useCatalogStore((s) => s.openCompare);
  const { activeId, setActive } = useCatalogParams();

  // Opening the comparison also dismisses the mobile drawer so it isn't hidden
  // behind the overlay.
  const handleCompare = () => {
    openCompare();
    if (isMobile) setSidebarOpen(false);
  };

  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState(false);
  const filtered = useMemo(() => filterCatalog(tree, search), [tree, search]);

  // On mobile the sidebar is an overlay drawer; selecting a node should close
  // it so the chosen content is revealed. Only fires on an actual nav change.
  const prevActiveRef = useRef(activeId);
  useEffect(() => {
    if (prevActiveRef.current !== activeId) {
      prevActiveRef.current = activeId;
      if (isMobile) setSidebarOpen(false);
    }
  }, [activeId, isMobile, setSidebarOpen]);

  // When the persistent sidebar is closed it collapses to a slim icon rail
  // that temporarily expands on hover, then collapses again on mouse-leave.
  // Hover-to-expand is a desktop affordance only.
  const expanded = open || (hovered && !isMobile);
  const floating = hovered && !open && !isMobile;

  // ---- Mobile: off-canvas drawer that overlays the content ----
  if (isMobile) {
    return (
      <>
        {/* Backdrop — tap to dismiss. */}
        {open && (
          // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          data-state={open ? "open" : "closed"}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r bg-background shadow-xl transition-transform duration-300 ease-in-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full w-full flex-col">
            <SidebarFullPanel
              search={search}
              setSearch={setSearch}
              setActive={setActive}
              compareCount={compareCount}
              onCompareClick={handleCompare}
              isLoading={isLoading}
              isError={isError}
              refetch={refetch}
              filtered={filtered}
            />
          </div>
        </aside>
      </>
    );
  }

  // ---- Desktop: persistent column (pinned open or hover-expanding rail) ----
  return (
    <aside
      data-state={open ? "open" : "closed"}
      onMouseEnter={() => !open && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("relative h-full shrink-0", open ? "w-72" : "w-14")}
    >
      {/*
        The visible panel is absolutely positioned so that, when the rail is
        hover-expanded, it floats over the content instead of pushing it. When
        the sidebar is pinned open it simply fills the reserved width.
      */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex h-full flex-col overflow-hidden border-r bg-background transition-shadow duration-300 ease-in-out",
          expanded ? "w-72" : "w-14",
          floating && "shadow-xl",
        )}
      >
        {expanded ? (
          /* ---- Full panel (fixed width so content doesn't squish) ---- */
          <div className="flex h-full w-72 flex-col">
            <SidebarFullPanel
              search={search}
              setSearch={setSearch}
              setActive={setActive}
              compareCount={compareCount}
              onCompareClick={handleCompare}
              isLoading={isLoading}
              isError={isError}
              refetch={refetch}
              filtered={filtered}
            />
          </div>
        ) : (
          /* ---- Collapsed icon rail (shown while closed & not hovered) ---- */
          <div className="flex h-full w-14 flex-col items-center gap-1 py-4">
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Air Master — view all categories"
              title="Air Master — view all categories"
              className="rounded-md transition-opacity hover:opacity-80"
            >
              <Logo collapsed />
            </button>

            <div className="mx-auto my-2 h-px w-6 bg-border" />

            <RailButton
              label="Search products"
              onClick={() => setSidebarOpen(true)}
            >
              <Search className="size-5" />
            </RailButton>

            <RailButton
              label="Compare products"
              badge={compareCount}
              onClick={handleCompare}
            >
              <GitCompareArrows className="size-5" />
            </RailButton>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * The full sidebar body — brand, search, compare action and catalog tree.
 * Shared by the desktop expanded column and the mobile overlay drawer so the
 * two stay identical. The caller owns the fixed-width wrapper.
 */
function SidebarFullPanel({
  search,
  setSearch,
  setActive,
  compareCount,
  onCompareClick,
  isLoading,
  isError,
  refetch,
  filtered,
}: {
  search: string;
  setSearch: (value: string) => void;
  setActive: (id: string | null) => void;
  compareCount: number;
  onCompareClick: () => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  filtered: CatalogNode[];
}) {
  const navRef = useRef<HTMLElement>(null);
  const scrollPositionRef = useRef(0);

  // Preserve scroll position when tree updates (e.g., expanding/collapsing)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Save scroll position before updates
    const handleScroll = () => {
      scrollPositionRef.current = nav.scrollTop;
    };

    nav.addEventListener('scroll', handleScroll, { passive: true });
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after tree renders
  useEffect(() => {
    const nav = navRef.current;
    if (nav && scrollPositionRef.current > 0) {
      nav.scrollTop = scrollPositionRef.current;
    }
  });

  return (
    <>
      {/* Brand — returns to the catalogue root (all categories). */}
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={() => setActive(null)}
          aria-label="Air Master — view all categories"
          className="rounded-md transition-opacity hover:opacity-80"
        >
          <Logo />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="h-10 rounded-lg border bg-background pl-9 shadow-sm focus-visible:ring-2 focus-visible:ring-brand/20"
          />
        </div>
      </div>

      {/* Compare */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onCompareClick}
          disabled={compareCount === 0}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all",
            compareCount > 0
              ? "bg-brand/10 text-brand hover:bg-brand/20"
              : "bg-muted/50 text-muted-foreground cursor-not-allowed",
          )}
        >
          <GitCompareArrows className="size-4 shrink-0" />
          <span>Compare products</span>
          {compareCount > 0 && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground tabular-nums">
              {compareCount}
            </span>
          )}
        </button>
      </div>

      <div className="mx-4 mb-3 border-t" />

      {/* Catalog tree header */}
      <div className="px-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Product Catalog
        </h2>
      </div>

      {/* Catalog tree */}
      <nav
        ref={navRef}
        aria-label="Product catalog"
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        {isLoading ? (
          <TreeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-start gap-2 px-3 py-6 text-sm text-muted-foreground">
            <PackageSearch className="size-5" />
            <p>Couldn&apos;t load the catalog.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="font-medium text-brand hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            No products match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <AppSidebarTree nodes={filtered} forceExpand={search.length > 0} />
        )}
      </nav>
    </>
  );
}

/** Single icon affordance in the collapsed rail. */
function RailButton({
  label,
  badge,
  onClick,
  children,
}: {
  label: string;
  badge?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.625rem] font-bold text-brand-foreground tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          key={i}
          className="h-7 w-full animate-pulse rounded-md bg-muted"
        />
      ))}
    </div>
  );
}
