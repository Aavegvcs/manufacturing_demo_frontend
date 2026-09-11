"use client";

import {
  Download,
  Gauge,
  Hammer,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  Puzzle,
  Rotate3d,
  Ruler,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SectionKey } from "@/features/catalog";
import { AccessoriesPanel } from "./accessories-panel";
import { CalculationPanel } from "./calculation-panel";
import { CadViewerPanel } from "./cad-viewer-panel";
import { DimensionsPanel } from "./dimensions-panel";
import { DocumentsPanel } from "./documents-panel";
import { OverviewPanel } from "./overview-panel";
import type { ProductTabItem } from "./product-tabs";
import { SectionContentTab } from "./section-content-panel";

/** Display metadata for every known section key (label + tab icon). */
export const SECTION_META: Record<
  SectionKey,
  { label: string; icon: LucideIcon }
> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  construction: { label: "Construction", icon: Hammer },
  dimensions: { label: "Dimensions", icon: Ruler },
  performance: { label: "Performance", icon: Gauge },
  accessories: { label: "Accessories", icon: Puzzle },
  installation: { label: "Installation", icon: HardHat },
  downloads: { label: "Downloads", icon: Download },
  cad_preview: { label: "3D Model", icon: Rotate3d },
};

/** Render the body for a single section. Each panel loads its own data. */
function renderSection(key: SectionKey, productId: string): ReactNode {
  switch (key) {
    case "overview":
      return <OverviewPanel productId={productId} />;
    case "performance":
      return <CalculationPanel productId={productId} />;
    case "dimensions":
      return <DimensionsPanel productId={productId} />;
    case "accessories":
      return <AccessoriesPanel productId={productId} />;
    case "downloads":
      return <DocumentsPanel productId={productId} />;
    case "construction":
      return (
        <SectionContentTab
          productId={productId}
          section="construction"
          title="Construction"
          icon={Hammer}
          emptyHint="construction details"
        />
      );
    case "installation":
      return (
        <SectionContentTab
          productId={productId}
          section="installation"
          title="Installation"
          icon={HardHat}
          emptyHint="installation instructions"
        />
      );
    case "cad_preview":
      return <CadViewerPanel productId={productId} />;
    default:
      return null;
  }
}

/**
 * Build the product tab items from a category's section list. Unknown keys are
 * skipped so the UI never renders a tab it can't fill. Per-section content is
 * fetched by each panel from its own endpoint.
 */
export function buildSectionTabs(
  sections: SectionKey[],
  productId: string,
): ProductTabItem[] {
  return sections
    .filter((key) => key in SECTION_META)
    .map((key) => ({
      value: key,
      label: SECTION_META[key].label,
      icon: SECTION_META[key].icon,
      content: renderSection(key, productId),
    }));
}
