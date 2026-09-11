"use client";

import {
  Check,
  GitCompareArrows,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

import { Logo } from "@/components/brand/logo";
import {
  AppSidebar,
  buildSectionTabs,
  CatalogBreadcrumb,
  CatalogGrid,
  CompareModal,
  ProductConfigPanel,
  ProductTabs,
} from "@/components/layout";
import { Button } from "@/components/ui";
import {
  type CatalogNode,
  findNode,
  findNodePath,
  findPath,
  pathForNode,
  useCatalogParams,
  useCatalogStore,
  useCatalogTree,
  useProductSections,
} from "@/features/catalog";
import { useIsMobile } from "@/hooks";
import { useUiStore } from "@/store";

function CatalogPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleParameterPanel = useUiStore((s) => s.toggleParameterPanel);
  const isMobile = useIsMobile();

  const { data: tree = [] } = useCatalogTree();
  const { activeId, tab, setTab, setActive } = useCatalogParams();
  const expandPath = useCatalogStore((s) => s.expandPath);
  const compareIds = useCatalogStore((s) => s.compareIds);
  const toggleCompare = useCatalogStore((s) => s.toggleCompare);
  const active = useMemo(
    () => (activeId ? findNode(tree, activeId) : null),
    [tree, activeId],
  );

  // Back-compat: old links used ?node=<id>. Once the tree loads, rewrite them to
  // the clean path, preserving the other (detail) query params.
  const legacyNode = searchParams.get("node");
  useEffect(() => {
    if (!legacyNode || !tree.length) return;
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("node");
    const qs = rest.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
    const path = pathForNode(tree, legacyNode);
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [legacyNode, tree, searchParams, router]);

  // Ancestor names of the active node — used for the mobile product heading
  // (the breadcrumb is hidden on small screens, so the title carries context).
  const categoryTrail = useMemo(() => {
    if (!activeId) return "";
    const path = findNodePath(tree, activeId) ?? [];
    return path
      .slice(0, -1)
      .map((n) => n.name)
      .join(" • ");
  }, [tree, activeId]);

  // Reveal the active node in the tree by expanding its ancestor path. Runs on
  // load too, so a refreshed/shared URL still shows its node expanded.
  useEffect(() => {
    if (!tree.length || !activeId) return;
    const path = findPath(tree, activeId);
    if (path) expandPath(path);
  }, [tree, activeId, expandPath]);

  const isProduct = active?.kind === "product";
  const productId = isProduct && active ? active.id : null;
  const inCompare = productId ? compareIds.includes(productId) : false;

  // Sidebar default follows the view: collapsed to the icon rail on a product
  // detail (full-width detail), open on the catalog/category grid. Only fires on
  // the transition between the two, so manual toggles within a view persist.
  // On mobile the sidebar is an overlay drawer, so it always starts closed and
  // is opened on demand from the header — the view-based default is skipped.
  const prevIsProductRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      return;
    }
    if (prevIsProductRef.current !== isProduct) {
      prevIsProductRef.current = isProduct;
      setSidebarOpen(!isProduct);
    }
  }, [isMobile, isProduct, setSidebarOpen]);

  // Tabs are fully data-driven: the tab list comes from the product's category
  // (so it varies per category). Each tab's body loads its own content.
  const { data: sectionList, isLoading: sectionsLoading } =
    useProductSections(productId);

  const tabItems = useMemo(
    () =>
      sectionList && productId
        ? buildSectionTabs(sectionList.sections, productId)
        : [],
    [sectionList, productId],
  );

  // The active tab is URL-driven; fall back to the first tab when the URL has
  // no (or an unknown) tab for this product.
  const activeTab =
    tab && tabItems.some((t) => t.value === tab)
      ? tab
      : (tabItems[0]?.value ?? "");

  // No active node → the catalogue root: show every top-level category as cards.
  const root: CatalogNode = useMemo(
    () => ({
      id: "__root__",
      name: "Categories",
      kind: "category",
      children: tree,
    }),
    [tree],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Full-height catalog tree — collapses to give the rest full width. */}
      <AppSidebar />

      {/* Right side: top bar over the configuration + content. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:gap-3 md:px-8">
          {/* Mobile: open the catalog drawer. */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open catalog menu"
            className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* Mobile: brand logo — the breadcrumb has no room on small screens. */}
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label="Air Master — view all categories"
            className="flex min-w-0 flex-1 items-center rounded-md transition-opacity hover:opacity-80 md:hidden"
          >
            <Logo className="h-7 w-auto" />
          </button>

          {/* Desktop: manual sidebar toggle — the tree auto-collapses on a
              product detail page, so this is the pinned way back in without
              relying on the hover-to-peek behavior. */}
          {isProduct && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={
                sidebarOpen ? "Collapse catalog menu" : "Expand catalog menu"
              }
              title={
                sidebarOpen ? "Collapse catalog menu" : "Expand catalog menu"
              }
              className="hidden size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-5" />
              ) : (
                <PanelLeftOpen className="size-5" />
              )}
            </button>
          )}

          {/* Desktop: full breadcrumb trail. */}
          <CatalogBreadcrumb className="hidden min-w-0 flex-1 md:flex" />

          {isProduct && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant={inCompare ? "secondary" : "default"}
                onClick={() => productId && toggleCompare(productId)}
              >
                {inCompare ? <Check /> : <GitCompareArrows />}
                <span className="hidden lg:inline">
                  {inCompare ? "Added to comparison" : "Add to comparison"}
                </span>
              </Button>
              {/* Mobile: open the parameters drawer. */}
              <button
                type="button"
                onClick={toggleParameterPanel}
                aria-label="Open parameters"
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              >
                <SlidersHorizontal className="size-5" />
              </button>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Content: product tabs, or a grid of categories/models. */}
          <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
            <div className="w-full p-6 md:p-8">
              {isProduct ? (
                <>
                  {/* Mobile-only product heading — replaces the hidden
                      breadcrumb so the title and its category stay visible. */}
                  {active && (
                    <div className="mb-5 md:hidden">
                      {categoryTrail && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {categoryTrail}
                        </p>
                      )}
                      <h1 className="mt-1 text-2xl font-bold text-foreground">
                        {active.name}
                      </h1>
                    </div>
                  )}

                  {sectionsLoading ? (
                    <TabsSkeleton />
                  ) : tabItems.length > 0 ? (
                    <ProductTabs
                      items={tabItems}
                      value={activeTab}
                      onValueChange={setTab}
                    />
                  ) : (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No detail sections are configured for this product.
                    </p>
                  )}
                </>
              ) : (
                <CatalogGrid node={active ?? root} />
              )}
            </div>
          </main>

          {/* Parameters — self-hides unless a product is active, sits on the right. */}
          <ProductConfigPanel />
        </div>
      </div>

      {/* Product comparison overlay (driven by the catalog store). */}
      <CompareModal />
    </div>
  );
}

/**
 * `useSearchParams` (via `useCatalogParams`) requires a Suspense boundary in the
 * App Router; the whole catalogue reads URL state, so one boundary wraps it all.
 */
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogPageInner />
    </Suspense>
  );
}

function TabsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
          <div key={i} className="h-5 w-24 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
