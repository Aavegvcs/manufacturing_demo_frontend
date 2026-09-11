"use client";

import { ChevronLeft, Home } from "lucide-react";
import { Fragment, useMemo } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui";
import {
  findNodePath,
  useCatalogParams,
  useCatalogStore,
  useCatalogTree,
} from "@/features/catalog";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb for the current catalog location. Fully data-driven: the trail is
 * derived from the active node's path. A leading Home crumb returns to the
 * catalogue root (all categories); the back arrow steps up one level, landing
 * on the root from a top-level category.
 */
export function CatalogBreadcrumb({ className }: { className?: string }) {
  const { data: tree = [] } = useCatalogTree();
  const { activeId, setActive } = useCatalogParams();
  const expandPath = useCatalogStore((s) => s.expandPath);

  const path = useMemo(
    () => (activeId ? (findNodePath(tree, activeId) ?? []) : []),
    [tree, activeId],
  );

  const goTo = (id: string) => {
    const target = findNodePath(tree, id);
    if (target) expandPath(target.map((n) => n.id));
    setActive(id);
  };

  const atRoot = path.length === 0;

  const goBack = () => {
    if (path.length >= 2) goTo(path[path.length - 2].id);
    else setActive(null); // top-level category (or root) → catalogue root
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <button
        type="button"
        onClick={goBack}
        disabled={atRoot}
        aria-label="Go back"
        className="shrink-0 text-muted-foreground transition-colors hover:text-brand disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>

      <Breadcrumb className="scrollbar-none min-w-0 overflow-x-auto">
        <BreadcrumbList className="flex-nowrap gap-1.5 whitespace-nowrap sm:gap-1.5">
          {/* Home / root */}
          <BreadcrumbItem>
            {atRoot ? (
              <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-brand">
                <Home className="size-4" />
                Catalogue
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="All categories"
                  className="flex items-center hover:text-brand"
                >
                  <Home className="size-4" />
                </button>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>

          {path.map((node, index) => {
            const isLast = index === path.length - 1;
            return (
              <Fragment key={node.id}>
                <BreadcrumbSeparator className="[&>svg]:hidden">
                  <span className="text-muted-foreground/60">&bull;</span>
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-semibold text-brand">
                      {node.name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        onClick={() => goTo(node.id)}
                        className="hover:text-brand"
                      >
                        {node.name}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
