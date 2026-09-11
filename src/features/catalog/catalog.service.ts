import { http } from "@/services/api/http";

import aagAccessoriesMock from "./aag-accessories.mock.json";
import aagCalculationMock from "./aag-calculation.mock.json";
import aagDimensionsMock from "./aag-dimensions.mock.json";
import aagDownloadsMock from "./aag-downloads.mock.json";
import aagOverviewMock from "./aag-overview.mock.json";
import mock from "./catalog.mock.json";
import type {
  CatalogNode,
  CatalogTreeResponse,
  ProductCalculation,
  ProductConfig,
  ProductOverview,
  ProductSectionContent,
  ProductSectionsResponse,
  SectionKey,
} from "./catalog.types";
import configMock from "./product-config.mock.json";

/** Section content hardcoded for the AAG demo, keyed by section. */
const AAG_SECTION_CONTENT: Partial<Record<SectionKey, unknown>> = {
  dimensions: aagDimensionsMock,
  accessories: aagAccessoriesMock,
  downloads: aagDownloadsMock,
  // No AAG-specific 3D mesh yet — reuse the bundled demo geometry (omitting
  // viewerUrl/downloads lets CadViewerPanel fall back to it) under the real
  // product name, so the tab demonstrates the viewer rather than sitting empty.
  cad_preview: { modelName: "AAG Double Deflection Grille (illustrative model)" },
};

/** Toggle to flip between the mock and a real backend without touching callers. */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_CATALOG !== "false";

/**
 * Data-access layer for the product catalog.
 *
 * Today it serves a local mock that mimics the API envelope and latency. When
 * the backend is ready, set NEXT_PUBLIC_USE_MOCK_CATALOG=false and the real
 * branch (`http.get<CatalogTreeResponse>("/catalog/tree")`) takes over — no
 * component or hook changes required (Dependency Inversion).
 */
export const catalogService = {
  getTree: async (): Promise<CatalogNode[]> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return (mock as CatalogTreeResponse).tree;
    }

    const { tree } = await http.get<CatalogTreeResponse>("/catalog/tree");
    return tree;
  },

  /**
   * Parameter schema (parameters + options) for a product — drives the
   * right-side Parameter panel. Per-product in the real API; the mock returns
   * the same NOVA-A schema for every id so the UI is demonstrable end-to-end.
   * Served at `/catalog/products/:id/parameter` (renamed from `/config`).
   */
  getProductParameter: async (
    productId: string,
    section?: SectionKey,
  ): Promise<ProductConfig> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ...(configMock as ProductConfig), productId };
    }

    const qs = section ? `?section=${encodeURIComponent(section)}` : "";
    return http.get<ProductConfig>(
      `/catalog/products/${productId}/parameter${qs}`,
    );
  },

  /**
   * Performance datasets (pressure/throw/sound curves + octave-band spectra)
   * for a product, driving the Calculation page. Empty `datasets` means the
   * product has no published performance data yet.
   */
  getCalculation: async (productId: string): Promise<ProductCalculation> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ...(aagCalculationMock as ProductCalculation), productId };
    }

    return http.get<ProductCalculation>(
      `/catalog/products/${productId}/calculation`,
    );
  },

  /** Overview payload (hero image, fact cards, description) for a product. */
  getOverview: async (productId: string): Promise<ProductOverview> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ...(aagOverviewMock as ProductOverview), productId };
    }

    return http.get<ProductOverview>(`/catalog/products/${productId}/overview`);
  },

  /**
   * Dynamic tab list (from the product's category). Drives which product tabs
   * render; each tab's content is fetched separately via
   * {@link catalogService.getProductSectionContent}. Served at
   * `/catalog/products/:id/sections` (renamed from `/parameter`).
   */
  getProductSections: async (
    productId: string,
  ): Promise<ProductSectionsResponse> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        productId,
        sections: [
          "overview",
          "performance",
          "dimensions",
          "cad_preview",
          "accessories",
          "downloads",
        ],
      };
    }

    return http.get<ProductSectionsResponse>(
      `/catalog/products/${productId}/sections`,
    );
  },

  /**
   * One section's content for a product. Served per-section so each tab loads
   * only the payload it renders; `content` is `null` when nothing is published.
   *
   * Sections with their own dedicated backend route (dimensions, accessories,
   * downloads, construction, installation) are fetched from that route; all
   * other keys fall back to the generic `/parameter/:section` endpoint.
   */
  getProductSectionContent: async (
    productId: string,
    section: SectionKey,
  ): Promise<ProductSectionContent> => {
    if (USE_MOCK && section in AAG_SECTION_CONTENT) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { productId, section, content: AAG_SECTION_CONTENT[section] };
    }

    const path = DEDICATED_SECTION_ROUTES.has(section)
      ? `/catalog/products/${productId}/${section}`
      : `/catalog/products/${productId}/parameter/${section}`;
    return http.get<ProductSectionContent>(path);
  },
};

/** Section keys that have a dedicated per-tab backend endpoint. */
const DEDICATED_SECTION_ROUTES = new Set<SectionKey>([
  "dimensions",
  "accessories",
  "downloads",
  "construction",
  "installation",
  // cad_preview has no dedicated route — it's served by the generic
  // /parameter/cad_preview endpoint (see catalog-facade.controller).
]);
