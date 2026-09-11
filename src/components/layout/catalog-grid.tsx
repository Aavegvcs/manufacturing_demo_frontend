"use client";

import { Check, ChevronRight, GitCompareArrows } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Typography } from "@/components/ui";
import {
  type CatalogNode,
  findNodePath,
  pathForNode,
  useCatalogParams,
  useCatalogStore,
  useCatalogTree,
  useProductOverview,
} from "@/features/catalog";
import { cn } from "@/lib/utils";


/**
 * Grid view shown when a category is active: one card per child
 * (sub-category or product) with an image and name. Clicking a sub-category
 * drills in; clicking a product opens its detail view.
 */
export function CatalogGrid({ node }: { node: CatalogNode }) {
  const { data: tree = [] } = useCatalogTree();
  const { setActive } = useCatalogParams();
  const expandPath = useCatalogStore((s) => s.expandPath);

  const children = node.children ?? [];

  const open = (child: CatalogNode) => {
    // Reveal the opened node in the tree by expanding its full ancestor path.
    const fullPath = findNodePath(tree, child.id);
    if (fullPath) expandPath(fullPath.map((n) => n.id));
    setActive(child.id);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Typography variant="h2" className="border-0 pb-0">
            {node.name}
          </Typography>
        </div>
        <Typography variant="muted">
          {children.length} {children.length === 1 ? "item" : "items"}
        </Typography>
      </div>

      {children.length === 0 ? (
        <Typography variant="muted">This category is empty.</Typography>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <li key={child.id} className="h-full">
              <CatalogCard child={child} onOpen={open} tree={tree} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getFirstProductImage(node: CatalogNode): string | undefined | null {
  if (node.thumbnail) return node.thumbnail;
  if (node.children) {
    for (const child of node.children) {
      const img = getFirstProductImage(child);
      if (img) return img;
    }
  }
  return undefined;
}

function CatalogCard({
  child,
  onOpen,
  tree,
}: {
  child: CatalogNode;
  onOpen: (child: CatalogNode) => void;
  tree: CatalogNode[];
}) {
  const isCategory = child.kind === "category";
  const compareIds = useCatalogStore((s) => s.compareIds);
  const toggleCompare = useCatalogStore((s) => s.toggleCompare);
  const inCompare = compareIds.includes(child.id);
  const expandPath = useCatalogStore((s) => s.expandPath);

  const { data: overview } = useProductOverview(isCategory ? null : child.id);
  const apiImages = (overview?.images ?? []).filter((im) => im.url);
  const imageUrl = apiImages.length > 0 ? apiImages[0].url : (child.thumbnail || getFirstProductImage(child));

  const href = pathForNode(tree, child.id);

  const handleClick = () => {
    // Reveal the opened node in the tree by expanding its full ancestor path.
    const fullPath = findNodePath(tree, child.id);
    if (fullPath) expandPath(fullPath.map((n) => n.id));
  };

  return (
    <div className="group relative h-full">
      <Link
        href={href}
        onClick={handleClick}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border-soft bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        {/* Image / thumbnail — fixed height across every card regardless of
            intrinsic image aspect, so a row of cards is visually uniform. */}
        <div className="relative flex h-40 shrink-0 items-center justify-center p-4 sm:h-56">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={child.name}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
              className="object-contain p-4"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/20 text-xs text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Label — no top border; keeps the card free of internal dividers. */}
        <div className="flex min-h-[68px] flex-1 items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-brand">
              {child.name}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand",
            )}
          />
        </div>
      </Link>

      {/* Compare toggle — products only. Sits above the card button. */}
      {!isCategory && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCompare(child.id);
          }}
          aria-pressed={inCompare}
          title={inCompare ? "Remove from comparison" : "Add to comparison"}
          className={cn(
            "absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-lg border shadow-sm backdrop-blur transition-colors",
            inCompare
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border bg-background/90 text-muted-foreground hover:text-brand",
          )}
        >
          {inCompare ? (
            <Check className="size-4" />
          ) : (
            <GitCompareArrows className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}
