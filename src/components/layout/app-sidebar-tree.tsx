"use client";

import {
  Activity,
  AirVent,
  Blinds,
  ChevronRight,
  CircleDashed,
  Fan,
  Flame,
  Folder,
  Gauge,
  LayoutGrid,
  type LucideIcon,
  Package,
  Radar,
  Rows3,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Target,
  Volume2,
  Wind,
} from "lucide-react";

import {
  type CatalogNode,
  useCatalogParams,
  useCatalogStore,
} from "@/features/catalog";
import { cn } from "@/lib/utils";

/** Count total children recursively */
function countChildren(node: CatalogNode): number {
  if (!node.children?.length) return 0;
  return node.children.reduce((sum, child) => {
    return sum + 1 + countChildren(child);
  }, 0);
}

/**
 * Keyword → icon. Ordered from most specific to most generic so a subcategory
 * like "Fire Damper" matches Flame before falling through to the generic
 * damper icon.
 */
const ICON_RULES: { match: string[]; icon: LucideIcon }[] = [
  // Life-safety dampers
  { match: ["fire-smoke", "fire & smoke"], icon: ShieldCheck },
  { match: ["fire"], icon: Flame },
  { match: ["smoke"], icon: Wind },
  { match: ["life-safety", "life safety"], icon: ShieldCheck },
  // Dampers (volume control / back-draft / pressure relief)
  {
    match: ["back-draft", "back draft", "pressure-relief", "pressure relief"],
    icon: SlidersHorizontal,
  },
  { match: ["round-volume", "round volume"], icon: CircleDashed },
  {
    match: ["volume-control", "volume control", "damper"],
    icon: SlidersHorizontal,
  },
  // Louvers
  { match: ["acoustic-louver", "acoustic louver"], icon: Volume2 },
  { match: ["storm", "sand", "weather", "louver"], icon: Blinds },
  // Nozzles / jet products
  { match: ["jet-flow", "jet flow"], icon: Radar },
  { match: ["jet", "spot"], icon: Target },
  { match: ["drum"], icon: Radar },
  { match: ["nozzle"], icon: Target },
  // Diffusers / slot diffusers
  { match: ["slot", "linear-slot", "linear slot"], icon: Rows3 },
  {
    match: [
      "swirl",
      "displacement",
      "plaque",
      "disc-valve",
      "disc valve",
      "diffuser",
    ],
    icon: Snowflake,
  },
  // Grilles
  { match: ["floor-grille", "linear-floor", "floor"], icon: LayoutGrid },
  { match: ["grille", "grill", "register", "egg"], icon: LayoutGrid },
  // VAV / CAV / Airflow measurement
  { match: ["vav", "cav", "terminal-unit", "terminal unit"], icon: Fan },
  { match: ["air-flow", "air flow", "measurement"], icon: Gauge },
  // Sound attenuators / cross talk
  {
    match: ["sound", "attenuator", "silencer", "cross-talk", "cross talk"],
    icon: Volume2,
  },
  // Fans / inline
  { match: ["fan", "inline"], icon: Fan },
  // Filters / HEPA
  { match: ["filter", "hepa", "iaq"], icon: Activity },
  // Air distribution / vent
  { match: ["under-floor", "underfloor"], icon: AirVent },
];

function iconFor(node: CatalogNode): LucideIcon {
  const haystack = `${node.id} ${node.name}`.toLowerCase();
  for (const { match, icon } of ICON_RULES) {
    if (match.some((m) => haystack.includes(m))) return icon;
  }
  return node.kind === "product" ? Package : Folder;
}

interface TreeProps {
  nodes: CatalogNode[];
  /** When true (search active), every category renders expanded. */
  forceExpand?: boolean;
  depth?: number;
}

/**
 * Renders a list of catalog nodes recursively to any depth. At the root
 * level items get a divider between them to visually break up long
 * top-level lists like the product catalog.
 */
export function AppSidebarTree({ nodes, forceExpand, depth = 0 }: TreeProps) {
  const isRoot = depth === 0;
  return (
    <ul
      role={isRoot ? "tree" : "group"}
      className={cn("flex flex-col", isRoot ? "gap-0 divide-y" : "gap-1")}
    >
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={depth}
          forceExpand={forceExpand}
          siblings={nodes}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  forceExpand,
  siblings,
}: {
  node: CatalogNode;
  depth: number;
  forceExpand?: boolean;
  /** Nodes at the same level, used to collapse siblings accordion-style. */
  siblings: CatalogNode[];
}) {
  const isExpandedInStore = useCatalogStore((s) => s.expanded[node.id]);
  const setExpanded = useCatalogStore((s) => s.setExpanded);
  const { activeId, setActive } = useCatalogParams();

  const hasChildren = Boolean(node.children?.length);
  const isOpen = forceExpand || isExpandedInStore;
  const isActive = activeId === node.id;
  const childCount = !isOpen && hasChildren ? countChildren(node) : 0;
  const NodeIcon = iconFor(node);
  const isRoot = depth === 0;

  // Indent scales with depth so the hierarchy reads clearly at any level.
  const indent = depth * 16 + 12;

  if (hasChildren) {
    // Accordion behavior: collapsing every other expandable sibling before a
    // node opens keeps at most one category open per level.
    const collapseSiblings = () => {
      for (const sibling of siblings) {
        if (sibling.id !== node.id && sibling.children?.length) {
          setExpanded(sibling.id, false);
        }
      }
    };

    // Clicking a category makes it active (shows its grid) and expands it.
    const handleCategoryClick = () => {
      setActive(node.id);
      collapseSiblings();
      setExpanded(node.id, true);
    };

    const handleToggle = () => {
      if (isOpen) {
        setExpanded(node.id, false);
      } else {
        collapseSiblings();
        setExpanded(node.id, true);
      }
    };

    return (
      <li className={cn("relative", isRoot && "py-0.5")}>
        {/* Vertical connecting line for nested items */}
        {depth > 0 && (
          <span className="absolute left-1 top-0 bottom-0 w-px bg-border" />
        )}

        <div
          className={cn(
            "group relative flex items-center rounded-lg transition-colors",
            isActive ? "bg-brand/10" : "hover:bg-accent",
          )}
        >
          {isActive && (
            <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />
          )}

          {/* Indent spacer — kept separate from the chevron button below so the
              button's own hit area stays a fixed size at every depth instead
              of growing (and overlapping the icon/label) as indent increases. */}
          <span
            style={{ width: indent }}
            className="shrink-0"
            aria-hidden="true"
          />

          {/* Chevron expand/collapse button — every expandable category gets
              one, at every nesting level, not just root. */}
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-label={
              isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform duration-200",
                isOpen && "rotate-90",
              )}
            />
          </button>

          {/* Category-specific icon */}
          <div className="flex items-center shrink-0 mr-2">
            <NodeIcon
              className={cn(
                isRoot ? "size-[18px]" : "size-4",
                isActive ? "text-brand" : "text-muted-foreground",
              )}
            />
          </div>

          {/* Category name */}
          <button
            type="button"
            onClick={handleCategoryClick}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 pr-2 text-left transition-colors",
              isRoot
                ? "py-2.5 text-sm font-semibold"
                : "py-2 text-sm font-medium",
              isActive ? "text-brand" : "text-foreground hover:text-brand",
            )}
          >
            <span className="truncate">{node.name}</span>
          </button>

          {/* Child count badge when collapsed */}
          {childCount > 0 && (
            <span className="shrink-0 mr-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {childCount}
            </span>
          )}
        </div>

        {isOpen && node.children && (
          <div className="mt-1">
            <AppSidebarTree
              nodes={node.children}
              depth={depth + 1}
              forceExpand={forceExpand}
            />
          </div>
        )}
      </li>
    );
  }

  // Leaf product.
  return (
    <li className="relative">
      {/* Vertical connecting line for nested items */}
      {depth > 0 && (
        <span className="absolute left-1 top-0 bottom-0 w-px bg-border" />
      )}

      <button
        type="button"
        onClick={() => setActive(node.id)}
        aria-current={isActive ? "true" : undefined}
        style={{ paddingLeft: indent + 32 }}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left text-sm transition-colors",
          isActive
            ? "bg-brand/10 font-medium text-brand"
            : "text-foreground/80 hover:bg-accent hover:text-foreground",
        )}
      >
        {isActive && (
          <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />
        )}
        <NodeIcon
          className={cn(
            "size-3.5 shrink-0",
            isActive ? "text-brand" : "text-muted-foreground",
          )}
        />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
