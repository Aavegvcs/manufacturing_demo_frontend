"use client";

import {
  ArrowRight,
  Headset,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SlotDiffuserParameters } from "./slot-diffuser-calculator";
import { AdjustableGrilleParameters } from "./adjustable-grille-calculator";
import { JetNozzleParameters } from "./jet-nozzle-calculator";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  findNode,
  type ProductConfig,
  type SectionKey,
  useCatalogParams,
  useCatalogTree,
  useProductCalculation,
  useProductParameter,
  useProductSections,
} from "@/features/catalog";
import { useIsMobile } from "@/hooks";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store";
import {
  airflowExtent,
  defaultThrowKey,
  fmt,
  groupValues,
  parseThrowKey,
  pickCalcDataset,
  rowsForGroup,
  throwBases,
  throwPartsOf,
  throwVels,
} from "./calc-utils";
import { ProductConfigurator } from "./product-configurator";

const EMPTY_SELECTION: Record<string, string> = {};

/** Collect each parameter's default option value into a flat selection map. */
function configDefaults(config: ProductConfig): Record<string, string> {
  const values: Record<string, string> = {};
  for (const group of config.groups) {
    for (const param of group.parameters) {
      if (param.defaultValue) values[param.id] = param.defaultValue;
    }
  }
  return values;
}

/**
 * Right-side panel: configuration parameters for the active product.
 * Renders nothing unless a product (not a category) is active.
 * Can be collapsed via the toggle button.
 */
export function ProductConfigPanel() {
  const { data: tree = [] } = useCatalogTree();
  const { activeId, selections, setSelection, tab } = useCatalogParams();
  const parameterPanelOpen = useUiStore((s) => s.parameterPanelOpen);
  const toggleParameterPanel = useUiStore((s) => s.toggleParameterPanel);
  const setParameterPanelOpen = useUiStore((s) => s.setParameterPanelOpen);
  const isMobile = useIsMobile();

  const selected = useMemo(
    () => (activeId ? findNode(tree, activeId) : null),
    [tree, activeId],
  );

  const productId = selected?.kind === "product" ? selected.id : null;

  // Active section drives WHICH parameters show. The active tab is the source;
  // fall back to the product's first section before a tab is chosen.
  const { data: sectionsResp } = useProductSections(productId);
  const section: SectionKey | undefined =
    (tab as SectionKey | null) ?? sectionsResp?.sections?.[0];

  // Two reads: the full schema seeds every default into the URL (so all tabs can
  // filter their data immediately), while the section-scoped schema drives what
  // the configurator renders for the active tab.
  const { data: fullConfig } = useProductParameter(productId);
  const { data: config, isLoading } = useProductParameter(productId, section);

  // Seed the URL with each product's default selection as soon as its full
  // config loads — independent of the active tab — so the tab panels can filter
  // their data even before the user touches a control.
  useEffect(() => {
    if (!fullConfig) return;
    if (selections[fullConfig.productId]) return;
    setSelection(fullConfig.productId, configDefaults(fullConfig));
  }, [fullConfig, selections, setSelection]);

  // On mobile the parameter panel is an overlay drawer; collapse it whenever we
  // cross into the mobile breakpoint so it never covers the content on load.
  // The header's "Parameters" button re-opens it on demand.
  const wasMobileRef = useRef(false);
  useEffect(() => {
    if (isMobile && !wasMobileRef.current) setParameterPanelOpen(false);
    wasMobileRef.current = isMobile;
  }, [isMobile, setParameterPanelOpen]);

  if (!selected || selected.kind !== "product") return null;

  // Parameters surfaced as dedicated Calculation controls — hide from the
  // generic configurator so they don't appear twice. Jet Nozzle's damper
  // isn't a Calculation control (it doesn't drive which performance dataset
  // applies), so it's left for the generic configurator to show on its own
  // declared sections (Overview/Accessories) instead of being hidden here.
  // `config.productId` is the facade node id ("prod:<slug>"), not the bare
  // route slug used elsewhere (e.g. isJetNozzle) — hence the prefix here.
  const CALC_MANAGED = new Set(
    config?.productId === "prod:jnz" ? ["deflection"] : ["deflection", "damper"],
  );
  const filteredConfig = config
    ? {
        ...config,
        groups: config.groups
          .map((g) => ({
            ...g,
            parameters: g.parameters.filter((p) => !CALC_MANAGED.has(p.id)),
          }))
          .filter((g) => g.parameters.length > 0),
      }
    : config;

  const body = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 pt-5">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground truncate">
            Parameter
          </span>
        </div>
        <button
          type="button"
          onClick={toggleParameterPanel}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Close parameters"
        >
          <PanelRightClose className="size-5" />
        </button>
      </div>

      {/* Parameters */}
      <div className="scrollbar-thin mt-4 flex-1 overflow-y-auto px-5 pb-4">
        {isLoading || !config ? (
          <ConfiguratorSkeleton />
        ) : (
          <>
            {/* Operating-point controls (size / air flow / throw) belong to the
                Performance tab — the data those parameters change lives there.
                The Dimensions tab shares the same Width/Height/Blade Deflection
                controls so the drawing can react to the entered size. */}
            {(section === "performance" || section === "dimensions") && (
              <CalculationParameters
                productId={config.productId}
                fullConfig={fullConfig}
                hideAirflow={section === "dimensions"}
              />
            )}
            {section !== "performance" && section !== "dimensions" && (
              <ProductConfigurator
                config={filteredConfig ?? config}
                values={selections[config.productId] ?? EMPTY_SELECTION}
                onChange={(values) => setSelection(config.productId, values)}
              />
            )}
          </>
        )}

        {/* Need-help card — scrolls in after the last parameter so it never
            covers the parameter list. */}
        <div className="mt-6 space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-base font-bold text-foreground">Need help?</h3>
          <p className="text-sm text-muted-foreground">
            Our experts are here to help you find the right solution.
          </p>
          <Button className="h-10 w-full justify-center rounded-lg shadow-sm">
            <Headset />
            Contact our experts
            <ArrowRight />
          </Button>
        </div>
      </div>
    </>
  );

  // ---- Mobile: off-canvas drawer from the right ----
  if (isMobile) {
    if (!parameterPanelOpen) return null;
    return (
      <>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
        <div
          className="fixed inset-0 z-40 bg-black/40"
          aria-hidden="true"
          onClick={toggleParameterPanel}
        />
        <aside className="fixed inset-y-0 right-0 z-50 flex w-[340px] max-w-[88vw] flex-col overflow-hidden border-l bg-background shadow-xl">
          {body}
        </aside>
      </>
    );
  }

  // ---- Desktop collapsed: slim toggle strip ----
  if (!parameterPanelOpen) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-l bg-accent/20 pt-4">
        <button
          type="button"
          onClick={toggleParameterPanel}
          className="flex flex-col items-center gap-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Open parameters"
        >
          <PanelRightOpen className="size-5" />
          <span
            className="text-sm font-medium tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Parameters
          </span>
        </button>
      </aside>
    );
  }

  // ---- Desktop expanded: persistent right column ----
  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l bg-accent/20">
      {body}
    </aside>
  );
}

/**
 * Operating-point inputs for the Calculation tab (size + air flow), shown in the
 * parameter panel like a manufacturer selection tool. Reads the active
 * performance dataset (filtered by the current option selection), seeds sensible
 * defaults into the shared store, and writes the user's choices back so the
 * Calculation charts/readout track them. Renders nothing for products without
 * air-flow-based performance data.
 */
function CalculationParameters({
  productId,
  fullConfig,
  hideAirflow = false,
}: {
  productId: string;
  /** The unfiltered parameter schema — used to look up the real "damper"
   *  option (its actual labels/values) since `deflection`/`damper` are
   *  stripped out of the generic configurator's config before it ever
   *  reaches this component (see CALC_MANAGED above). */
  fullConfig?: ProductConfig;
  /** Dimensions tab reuses this panel for Width/Height/Blade Deflection but
   *  has no use for Airflow — it doesn't affect the drawing. */
  hideAirflow?: boolean;
}) {
  const {
    selections,
    setSelection,
    calc: calcMap,
    setCalc,
  } = useCatalogParams();
  const selection = selections[productId] ?? EMPTY_SELECTION;
  const calc = calcMap[productId];
  const { data } = useProductCalculation(productId);

  // Admin-defined Mounting labels (calculation-config-editor.tsx) take
  // priority over the built-in sidewall/sill fallback in throwBasisLabel().
  const mountingLabels = useMemo(
    () =>
      Object.fromEntries(
        (data?.calculationConfig?.mountingOptions ?? []).map((o) => [
          o.key,
          o.label,
        ]),
      ),
    [data?.calculationConfig?.mountingOptions],
  );
  // Admin-configured label/unit/default/range for the three free-form
  // calculator inputs — defaulted server-side (DEFAULT_CALCULATION_CONFIG)
  // when the product hasn't set these, matching pre-feature behavior.
  const calculatorInputs = data?.calculationConfig?.calculatorInputs;

  // The product's own "Blade Deflection" / "Volume Control Damper" options, if
  // it has them — CALC_MANAGED hides both from the generic panel on every tab
  // on the assumption this panel handles them instead, so without this
  // they're unselectable anywhere. Sourced from the real option group (not a
  // hardcoded list) and rendered independent of isPerFoot/which dataset is
  // currently picked, so switching to a value whose matching dataset happens
  // to use a different column shape (e.g. 45° here isn't per-foot) doesn't
  // make the control that got you there disappear.
  const fullParams = fullConfig?.groups.flatMap((g) => g.parameters) ?? [];
  const deflectionParam = fullParams.find((p) => p.id === "deflection");
  const damperParam = fullParams.find((p) => p.id === "damper");

  const picked = useMemo(
    () => (data ? pickCalcDataset(data.datasets, selection) : null),
    [data, selection],
  );
  const groups = useMemo(
    () => (picked ? groupValues(picked.dataset, picked.analysis) : []),
    [picked],
  );

  const isAdjustableGrille = useMemo(() => {
    return data?.datasets.some(d => d.signature?.type === "area_factors") && data?.datasets.some(d => d.signature?.type === "performance_data");
  }, [data]);

  const isSlotDiffuser = useMemo(() => {
    return ["nsd", "sd", "hcs"].includes(productId) || data?.datasets.some(d =>
      d.columns.some(c => c.key === "slot_width_in")
    );
  }, [productId, data]);

  const isJetNozzle = useMemo(() => {
    return productId === "jnz" || data?.datasets.some(d =>
      d.columns.some(c => c.key === "size_mm") && d.columns.some(c => c.key.startsWith("air_flow"))
    );
  }, [productId, data]);

  // Detect a "per-foot" product — linear bar grilles and linear/slot diffusers
  // whose airflow axis is CFM per foot (keys `cfm_per_ft` / `cfm-per-foot` —
  // either separator, since the admin's column editor auto-generates
  // hyphenated keys from a label — or a "cfm/ft" unit). These share the
  // selection protocol from the COSMOS guides: total airflow ÷ effective
  // length → CFM/ft, then verify throw / NC / pressure.
  const isPerFoot =
    /per[-_]f(?:oo)?t/i.test(picked?.analysis.airflow.key ?? "") ||
    /cfm\s*\/\s*ft/i.test(picked?.analysis.airflow.unit ?? "");

  const lengthMm = calc?.lengthMm ?? 0;
  const widthMm = calc?.widthMm ?? 0;
  const totalCfm = calc?.totalCfm ?? 0;

  // The size dimension (Step 1: fix the width / choose the slot size) is the
  // dataset's grouping column. Its native unit differs by product — grilles list
  // nominal duct width in inches (`duct_width_in`), linear/slot diffusers list it
  // in mm (`width_mm`). The user always enters width in mm; snap that to the
  // nearest published size row, converting to the group's native unit first.
  const sizeKey = picked?.analysis.groupCol?.key ?? "";
  const sizeUnit = picked?.analysis.groupCol?.unit ?? "";
  const sizeIsMm = /mm/i.test(sizeKey) || /mm/i.test(sizeUnit);
  const targetSize = sizeIsMm ? widthMm : widthMm / 25.4;
  const snappedGroup =
    isPerFoot && groups.length && widthMm
      ? groups.reduce(
          (best, g) =>
            Math.abs(Number(g) - targetSize) <
            Math.abs(Number(best) - targetSize)
              ? g
              : best,
          groups[0],
        )
      : "";

  const group = snappedGroup
    ? snappedGroup
    : picked && calc?.group && groups.includes(calc.group)
      ? calc.group
      : (groups[0] ?? "");
  const rows = useMemo(
    () => (picked ? rowsForGroup(picked.dataset, picked.analysis, group) : []),
    [picked, group],
  );
  const [xMin, xMax] = picked ? airflowExtent(rows, picked.analysis) : [0, 1];

  // Per-foot products (Step 2): derive CFM/ft from total airflow ÷ effective
  // length, then write it as the airflow so the charts and readout stay in sync.
  useEffect(() => {
    if (!isPerFoot || !lengthMm || !totalCfm) return;
    const lengthFt = lengthMm / 304.8;
    const cfmPerFt = totalCfm / lengthFt;
    const clamped = Math.min(xMax, Math.max(xMin, cfmPerFt));
    if (clamped !== calc?.airflow) setCalc(productId, { airflow: clamped });
  }, [
    isPerFoot,
    lengthMm,
    totalCfm,
    xMin,
    xMax,
    calc?.airflow,
    productId,
    setCalc,
  ]);

  // Persist the width-snapped size row (Step 1) to the URL so the Calculation
  // tab's charts and readout table — which read calc.group — are read from the
  // same size row the Parameters panel selected.
  useEffect(() => {
    if (!isPerFoot || !snappedGroup) return;
    if (calc?.group !== snappedGroup)
      setCalc(productId, { group: snappedGroup });
  }, [isPerFoot, snappedGroup, calc?.group, productId, setCalc]);

  const airflow =
    calc?.airflow != null
      ? Math.min(xMax, Math.max(xMin, calc.airflow))
      : (xMin + xMax) / 2;

  // Seed / repair the store defaults whenever the active dataset or range changes.
  useEffect(() => {
    if (!picked) return;
    const hasGroups = groups.length > 0;
    const validGroup =
      !hasGroups || (!!calc?.group && groups.includes(calc.group));
    const g = hasGroups
      ? validGroup
        ? (calc?.group as string)
        : groups[0]
      : undefined;
    const [mn, mx] = airflowExtent(
      rowsForGroup(picked.dataset, picked.analysis, g ?? ""),
      picked.analysis,
    );
    const af = calc?.airflow;
    const validAf = af != null && af >= mn && af <= mx;
    const fallback = parseThrowKey(defaultThrowKey(picked.analysis));
    const validThrow =
      !fallback ||
      (!!calc?.throwBasis &&
        !!calc?.throwVel &&
        picked.analysis.throwCols.some((c) => {
          const p = throwPartsOf(c);
          return p && p.basis === calc.throwBasis && p.vel === calc.throwVel;
        }));
    if (!validGroup || (!isPerFoot && !validAf) || !validThrow) {
      setCalc(productId, {
        group: g,
        airflow: isPerFoot ? af : validAf ? af : (mn + mx) / 2,
        throwBasis: validThrow ? calc?.throwBasis : fallback?.basis,
        throwVel: validThrow ? calc?.throwVel : fallback?.vel,
      });
    }
  }, [
    productId,
    picked,
    groups,
    isPerFoot,
    calc?.group,
    calc?.airflow,
    calc?.throwBasis,
    calc?.throwVel,
    setCalc,
  ]);

  // Seed the per-foot calculator inputs (Width/Collar airflow/Effective
  // length) from the admin-configured defaults the first time the
  // calculator opens for this product — only when the URL doesn't already
  // carry a value, so an in-progress calculation is never overwritten.
  useEffect(() => {
    if (!isPerFoot || !calculatorInputs) return;
    const patch: { widthMm?: number; totalCfm?: number; lengthMm?: number } =
      {};
    if (!widthMm && calculatorInputs.widthMm.default != null) {
      patch.widthMm = calculatorInputs.widthMm.default;
    }
    if (!totalCfm && calculatorInputs.collarAirflowCfm.default != null) {
      patch.totalCfm = calculatorInputs.collarAirflowCfm.default;
    }
    if (!lengthMm && calculatorInputs.effectiveLengthMm.default != null) {
      patch.lengthMm = calculatorInputs.effectiveLengthMm.default;
    }
    if (Object.keys(patch).length > 0) setCalc(productId, patch);
  }, [isPerFoot, calculatorInputs, widthMm, totalCfm, lengthMm, productId, setCalc]);

  // The bespoke calculators (grille/slot-diffuser/jet-nozzle) supply their own
  // parameter controls and don't need `picked` — their datasets often have no
  // column `analyze()` recognizes as an air-flow axis (e.g. the grille's "Area
  // Factor" tables use a `ft³/min` unit `analyze()` doesn't match), so gating
  // this whole panel on `picked` would hide their inputs entirely.
  if (!picked && !isSlotDiffuser && !isAdjustableGrille && !isJetNozzle) {
    return null;
  }
  const a = picked?.analysis;
  const step = a ? (xMax - xMin) / 100 || 1 : 1;

  const fallback = a ? parseThrowKey(defaultThrowKey(a)) : null;
  const bases = a ? throwBases(a, mountingLabels) : [];
  const basis =
    a && calc?.throwBasis && bases.some((b) => b.value === calc.throwBasis)
      ? calc.throwBasis
      : (fallback?.basis ?? bases[0]?.value ?? "");
  const vels = a ? throwVels(a, basis) : [];
  const vel =
    calc?.throwVel && vels.includes(calc.throwVel)
      ? calc.throwVel
      : (vels[0] ?? fallback?.vel ?? "");

  return (
    <section className="border-b pb-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Calculation
      </h3>
      <div className="flex flex-col gap-3.5">
        {isSlotDiffuser && (
          <SlotDiffuserParameters datasets={data?.datasets || []} productId={productId} />
        )}
        {isAdjustableGrille && (
          <AdjustableGrilleParameters productId={productId} hideAirflow={hideAirflow} />
        )}
        {isJetNozzle && (
          <JetNozzleParameters datasets={data?.datasets || []} productId={productId} />
        )}
        {!isAdjustableGrille && !isSlotDiffuser && !isJetNozzle && a && (
          isPerFoot ? (
            <>
            {/* Mounting condition — determines which throw row (Sill/Floor vs
                Side-wall) the verification triad is read from. */}
            {bases.length > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  Mounting
                </span>
                <Select
                  value={basis}
                  onValueChange={(b) => {
                    const vs = throwVels(a, b);
                    setCalc(productId, {
                      throwBasis: b,
                      throwVel: vs.includes(vel) ? vel : (vs[0] ?? ""),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bases.map((b) => (
                      <SelectItem
                        key={b.value}
                        value={b.value}
                        className="text-xs"
                      >
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 1 — Fix the width. Entered in mm, snapped to the nearest
                published nominal duct-width row. */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
              <span className="text-xs font-normal text-muted-foreground">
                {calculatorInputs?.widthMm.label ?? "Width (mm)"}
              </span>
              <FreeNumberInput
                label={calculatorInputs?.widthMm.label ?? "Width (mm)"}
                value={widthMm || ""}
                min={calculatorInputs?.widthMm.min}
                max={calculatorInputs?.widthMm.max}
                unit={calculatorInputs?.widthMm.unit}
                onCommit={(v) => setCalc(productId, { widthMm: v })}
              />
            </div>
            {widthMm > 0 && group && (
              <p className="-mt-2 text-[11px] text-muted-foreground">
                {sizeIsMm
                  ? `Selected size ${group} mm row`
                  : `Nominal duct width ${group} in (${fmt(Number(group) * 25.4, 0)} mm row)`}
              </p>
            )}

            {/* Step 2 input — Collar airflow per grille. */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
              <span className="text-xs font-normal text-muted-foreground">
                {calculatorInputs?.collarAirflowCfm.label ?? "Collar airflow (CFM)"}
              </span>
              <FreeNumberInput
                label={
                  calculatorInputs?.collarAirflowCfm.label ??
                  "Collar airflow (CFM)"
                }
                value={totalCfm || ""}
                min={calculatorInputs?.collarAirflowCfm.min}
                max={calculatorInputs?.collarAirflowCfm.max}
                unit={calculatorInputs?.collarAirflowCfm.unit}
                onCommit={(v) => setCalc(productId, { totalCfm: v })}
              />
            </div>

            {/* Step 2 input — Effective (active) length, not nominal length. */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
              <span className="text-xs font-normal text-muted-foreground">
                {calculatorInputs?.effectiveLengthMm.label ??
                  "Effective length (mm)"}
              </span>
              <FreeNumberInput
                label={
                  calculatorInputs?.effectiveLengthMm.label ??
                  "Effective length (mm)"
                }
                value={lengthMm || ""}
                min={calculatorInputs?.effectiveLengthMm.min}
                max={calculatorInputs?.effectiveLengthMm.max}
                unit={calculatorInputs?.effectiveLengthMm.unit}
                onCommit={(v) => setCalc(productId, { lengthMm: v })}
              />
            </div>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Active length only — exclude blocked or non-active sections.
            </p>

            {/* Step 2 result — selection basis (CFM/ft) = collar airflow ÷
                effective length. */}
            {lengthMm > 0 && totalCfm > 0 && (
              <p className="text-[11px] font-medium text-foreground">
                Selection basis = {fmt(totalCfm / (lengthMm / 304.8))} CFM/ft
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — row range {fmt(xMin)}–{fmt(xMax)} CFM/ft
                </span>
              </p>
            )}

            {/* Throw terminal velocity (fpm) — refines the throw reading. */}
            {vels.length > 1 && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  Terminal velocity (fpm)
                </span>
                <Select
                  value={vel}
                  onValueChange={(v) => setCalc(productId, { throwVel: v })}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vels.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </>
        ) : (
          <>
            {/* Standard operating-point controls for non-linear-grille products */}
            {a.groupCol && groups.length > 1 && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  {a.groupCol.label}
                  {a.groupCol.unit ? ` (${a.groupCol.unit})` : ""}
                </span>
                <Select
                  value={group}
                  onValueChange={(g) => {
                    const [mn, mx] = airflowExtent(
                      rowsForGroup(picked.dataset, a, g),
                      a,
                    );
                    setCalc(productId, { group: g, airflow: (mn + mx) / 2 });
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g} value={g} className="text-xs">
                        {g}
                        {a.groupCol?.unit ? ` ${a.groupCol.unit}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
              <span className="text-xs font-normal text-muted-foreground">
                {a.airflow.label}
                {a.airflow.unit ? ` (${a.airflow.unit})` : ""}
              </span>
              <RangeNumberInput
                label={a.airflow.label}
                value={airflow}
                min={xMin}
                max={xMax}
                step={step < 1 ? 0.01 : 1}
                unit={a.airflow.unit}
                onCommit={(v) => setCalc(productId, { airflow: v })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Range {fmt(xMin)}–{fmt(xMax)} {a.airflow.unit}
            </p>

            {bases.length > 1 && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  Throw basis
                </span>
                <Select
                  value={basis}
                  onValueChange={(b) => {
                    const vs = throwVels(a, b);
                    setCalc(productId, {
                      throwBasis: b,
                      throwVel: vs.includes(vel) ? vel : (vs[0] ?? ""),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bases.map((b) => (
                      <SelectItem
                        key={b.value}
                        value={b.value}
                        className="text-xs"
                      >
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {vels.length > 1 && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  Terminal velocity (fpm)
                </span>
                <Select
                  value={vel}
                  onValueChange={(v) => setCalc(productId, { throwVel: v })}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vels.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
          )
        )}

        {/* Blade Deflection / Volume Control Damper — shown whenever the
            product actually has these options, independent of the per-foot/
            standard split above (and of which dataset is currently picked)
            so switching to a value like 45° that happens to resolve to a
            differently-shaped dataset doesn't make the control disappear. */}
        {deflectionParam && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
            <span className="text-xs font-normal text-muted-foreground">
              {deflectionParam.label}
            </span>
            <Select
              value={
                selection.deflection ??
                deflectionParam.defaultValue ??
                deflectionParam.options[0]?.value ??
                ""
              }
              onValueChange={(v) =>
                setSelection(productId, { ...selection, deflection: v })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deflectionParam.options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {damperParam && !isJetNozzle && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
            <span className="text-xs font-normal text-muted-foreground">
              {damperParam.label}
            </span>
            <Select
              value={selection.damper ?? damperParam.defaultValue ?? damperParam.options[0]?.value ?? ""}
              onValueChange={(v) =>
                setSelection(productId, { ...selection, damper: v })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {damperParam.options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </section>
  );
}

/** Validate a draft string against the [min, max] range; null = OK. */
function rangeWarning(
  draft: string,
  min: number,
  max: number,
  unit?: string,
): string | null {
  if (draft.trim() === "") return "Enter an air flow value.";
  const v = Number(draft);
  if (!Number.isFinite(v)) return "Enter a valid number.";
  const u = unit ? ` ${unit}` : "";
  if (v < min) return `Below the minimum of ${fmt(min)}${u}.`;
  if (v > max) return `Above the maximum of ${fmt(max)}${u}.`;
  return null;
}

/**
 * Range-bounded number input that stays editable and surfaces validation
 * warnings. Instead of clamping on every keystroke (which makes the field
 * impossible to clear or to type a value whose leading digits fall outside the
 * range), it keeps a local draft string while the user types: valid in-range
 * values are committed live so dependent charts/readouts track them, and the
 * value is clamped to [min, max] only on blur. While the draft is out of range
 * (or not a number) an inline warning is shown and the field is flagged
 * invalid, but the last valid value stays applied. `draft === null` means
 * "not editing — show the committed prop value".
 */
function RangeNumberInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const warning = draft !== null ? rangeWarning(draft, min, max, unit) : null;

  return (
    <div className="flex flex-col gap-1">
      <input
        type="number"
        aria-label={label}
        aria-invalid={warning != null}
        min={Math.floor(min)}
        max={Math.ceil(max)}
        step={step}
        value={draft ?? fmt(value)}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const v = Number(raw);
          if (raw !== "" && Number.isFinite(v) && v >= min && v <= max) {
            onCommit(v);
          }
        }}
        onBlur={() => {
          if (draft === null) return;
          const v = Number(draft);
          if (draft !== "" && Number.isFinite(v)) {
            onCommit(Math.min(max, Math.max(min, v)));
          }
          setDraft(null);
        }}
        className={cn(
          "h-8 w-full rounded-md border bg-background px-3 text-xs tabular-nums shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          warning &&
            "border-destructive text-destructive focus-visible:ring-destructive/40",
        )}
      />
      {warning && (
        <p className="flex items-start gap-1 text-[11px] text-destructive">
          <TriangleAlert className="mt-px size-3 shrink-0" />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Unbounded positive number input (rendered as text so the browser never
 * strips characters mid-edit). Local state persists through the async URL
 * update cycle — it only syncs back from the prop when the field is not
 * focused, preventing values from resetting on blur.
 */
export function FreeNumberInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  onCommit,
}: {
  label: string;
  value: number | string;
  /** Admin-configured range (calculation-config-editor.tsx); undefined =
   *  unconstrained, the original unbounded-positive-number behavior. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onCommit: (v: number) => void;
}) {
  const propStr = value === 0 || value === "" ? "" : String(value);
  const [local, setLocal] = useState(propStr);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent only when the field is not being edited.
  useEffect(() => {
    if (!focused) setLocal(propStr);
  }, [propStr, focused]);

  // Cancel any pending debounce on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const isValid = (v: number) =>
    Number.isFinite(v) &&
    v > 0 &&
    (min == null || v >= min) &&
    (max == null || v <= max);

  // Only surfaces once the admin has actually set a range — an unconstrained
  // input (min/max both undefined) never warns, matching prior behavior.
  const warning =
    focused && local !== "" && (min != null || max != null)
      ? (() => {
          const v = Number(local);
          const u = unit ? ` ${unit}` : "";
          if (!Number.isFinite(v)) return "Enter a valid number.";
          if (min != null && v < min) return `Below the minimum of ${fmt(min)}${u}.`;
          if (max != null && v > max) return `Above the maximum of ${fmt(max)}${u}.`;
          return null;
        })()
      : null;

  const scheduleCommit = (raw: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const v = Number(raw);
    if (raw !== "" && isValid(v)) {
      timerRef.current = setTimeout(() => onCommit(v), 400);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={warning != null}
        value={local}
        step={step}
        onChange={(e) => {
          setLocal(e.target.value);
          scheduleCommit(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (timerRef.current) clearTimeout(timerRef.current);
          const v = Number(local);
          if (local !== "" && Number.isFinite(v) && v > 0) {
            const clamped =
              min != null || max != null
                ? Math.min(max ?? v, Math.max(min ?? v, v))
                : v;
            onCommit(clamped);
          }
        }}
        className={cn(
          "h-8 w-full rounded-md border bg-background px-3 text-xs tabular-nums shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          warning &&
            "border-destructive text-destructive focus-visible:ring-destructive/40",
        )}
      />
      {warning && (
        <p className="flex items-start gap-1 text-[11px] text-destructive">
          <TriangleAlert className="mt-px size-3 shrink-0" />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
}

function ConfiguratorSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          key={i}
          className="flex items-center justify-between gap-3"
        >
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}
