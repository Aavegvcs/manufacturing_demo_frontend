/**
 * A node in the product catalog tree. The same shape is used at every level
 * (category or leaf product), so the UI can render it recursively to an
 * arbitrary depth — the screenshot uses three, but nothing here is hard-coded
 * to three.
 */
export interface CatalogNode {
  id: string;
  name: string;
  kind: "category" | "product";
  /** Article/SKU number for leaf products. */
  articleNo?: string;
  /** Optional thumbnail URL for leaf products. */
  thumbnail?: string | null;
  children?: CatalogNode[];
}

/** Envelope returned by the catalog endpoint. */
export interface CatalogTreeResponse {
  tree: CatalogNode[];
}

/** A single selectable option for a configuration parameter. */
export interface ConfigOption {
  value: string;
  label: string;
}

/** One configurable parameter (rendered as a labelled dropdown). */
export interface ConfigParameter {
  id: string;
  label: string;
  options: ConfigOption[];
  defaultValue?: string;
  placeholder?: string;
  /**
   * Sections this parameter belongs to. Omitted = global (shown on every tab).
   * The backend can filter to one section via `?section=`; the panel also reads
   * this to scope the visible parameter set to the active tab.
   */
  sections?: SectionKey[];
}

/** A collapsible group of parameters, e.g. "Main selections". */
export interface ConfigGroup {
  id: string;
  title: string;
  parameters: ConfigParameter[];
  defaultOpen?: boolean;
}

/** The full configuration schema for a product. */
export interface ProductConfig {
  productId: string;
  groups: ConfigGroup[];
}

/** A column in a performance dataset (mirrors the backend performance table). */
export interface CalcColumn {
  key: string;
  label: string;
  unit?: string;
  type?: "number" | "text";
  // Explicit throw-column metadata, set by the admin's Mounting / Terminal
  // velocity dropdowns. When present, calc-utils.ts uses these directly
  // instead of regex-parsing `key`; absent on legacy columns, which fall
  // back to that parsing unchanged.
  mountingKey?: string;
  terminalVelocity?: string;
}

/**
 * Admin-managed Mounting/Terminal-velocity choices + calculator-input
 * (Width/Collar airflow/Effective length) config for the Calculation
 * parameter panel. Always present on ProductCalculation — defaulted
 * server-side when a product hasn't configured one.
 */
export interface NumericInputConfig {
  label: string;
  unit: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface CalculationConfig {
  mountingOptions: { key: string; label: string }[];
  terminalVelocityOptions: { value: string; label: string }[];
  calculatorInputs: {
    widthMm: NumericInputConfig;
    collarAirflowCfm: NumericInputConfig;
    effectiveLengthMm: NumericInputConfig;
  };
}

/**
 * Explicit display config set by an admin. Absent = infer chart vs table from
 * the columns (the default heuristic path). `mode: "graph"` forces a line chart;
 * `xKey`/`yKeys` pick the axes (falling back to heuristics when omitted).
 */
export interface CalcChart {
  mode: "table" | "graph" | "both";
  xKey?: string;
  yKeys?: string[];
}

/**
 * One performance dataset. Generic columns/rows so the Calculation page can
 * render any shape: a "curve" dataset (airflow vs pressure/throw/sound) drives
 * the chart + parameter table; a "spectrum" dataset (a `band` column) drives
 * the octave-band table.
 */
export interface CalcDataset {
  id: string;
  label: string;
  /** Option filter this dataset applies to ({} = all combinations). */
  signature: Record<string, string>;
  columns: CalcColumn[];
  rows: Record<string, number | string | null>[];
  /** Explicit admin display choice; omitted = infer chart vs table. */
  chart?: CalcChart;
}

/** All performance datasets for a product. */
export interface ProductCalculation {
  productId: string;
  datasets: CalcDataset[];
  calculationConfig: CalculationConfig;
}

/**
 * The set of product detail tabs. The tab list shown for a product is sourced
 * from its category (so it varies per category); each key's content comes from
 * the product itself (so it varies per product).
 */
export type SectionKey =
  | "overview"
  | "construction"
  | "dimensions"
  | "performance"
  | "accessories"
  | "installation"
  | "downloads"
  | "cad_preview";

/**
 * Dynamic tab list for a product — the ordered set of section tabs to render
 * (sourced from the product's category). Per-section content is fetched on
 * demand via its own endpoint, not bundled here.
 */
export interface ProductSectionsResponse {
  productId: string;
  sections: SectionKey[];
}

/**
 * A single section's content (open shape). `content` is `null` when the product
 * has no published content for the key → the tab renders an empty state.
 */
export interface ProductSectionContent {
  productId: string;
  section: SectionKey;
  content: unknown;
}

/** A labelled highlight shown as a card on the Overview tab. */
export interface ProductFact {
  key: string;
  label: string;
  value: string;
}

/**
 * A per-option override layered onto the base facts: when `match` is
 * satisfied by the current selection (same partial-match rule as image/drawing
 * `match` — only keys present in `match` are checked, omitted = applies to
 * every selection), each key in `values` overrides (or adds) a fact. Multiple
 * matching variants apply in array order, later ones winning on conflict.
 */
export interface SpecVariant {
  match?: Record<string, string>;
  values: Record<string, unknown>;
  label?: string;
}

/** Everything the Overview tab renders for a product. */
export interface ProductOverview {
  productId: string;
  name: string;
  articleNo: string;
  description: string | null;
  images: { url: string; alt?: string; match?: Record<string, string> }[];
  facts: ProductFact[];
  specVariants: SpecVariant[];
}
