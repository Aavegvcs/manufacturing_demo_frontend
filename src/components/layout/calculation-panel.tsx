"use client";

import { ChevronDown, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui";
import {
  type CalcColumn,
  type CalcDataset,
  signatureMatches,
  useCatalogParams,
  useProductCalculation,
} from "@/features/catalog";
import { cn } from "@/lib/utils";
import {
  type Analysis,
  type DamperVelocityAnalysis,
  airflowExtent,
  analyze,
  analyzeDamperVelocity,
  ductAreaFt2,
  fmt,
  freqColumns,
  groupValues,
  interp,
  isOctaveBands,
  isSpectrum,
  num,
  resolveThrowKey,
  rowsForGroup,
} from "./calc-utils";
import { type ChartSeries, PerformanceChart } from "./performance-chart";
import { FreeNumberInput } from "./product-config-panel";
import { AdjustableGrilleCalculator } from "./adjustable-grille-calculator";
import { SlotDiffuserCalculator } from "./slot-diffuser-calculator";
import { JetNozzleCalculator } from "./jet-nozzle-calculator";
import { groupReadoutsByLabel, ReadoutRow, ReadoutTableHead } from "./readout-table";

// Distinct line colours for the per-size frequency-response curves.
const SERIES_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#475569",
  "#ea580c",
];

const EMPTY_SELECTION: Record<string, string> = {};
const LINE = "#2563eb";

export function CalculationPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductCalculation(productId);
  const { selections } = useCatalogParams();
  const selection = selections[productId] ?? EMPTY_SELECTION;

  // Only show datasets whose option signature applies to the current selection
  // — EXCEPT datasets belonging to a dedicated calculator (grille/slot-diffuser/
  // jet-nozzle). Those already have their own explicit dataset-picker control
  // (Plenum, Height, ...) that's independent of the top-level product option
  // selector, which the Performance tab doesn't even expose (it's replaced by
  // the Calculation parameter panel there) — so gating them by `selection` too
  // would desync the two: e.g. SD's dataset signature intentionally mirrors
  // its "type" option (to satisfy generic products), but that same option is
  // stuck at its default while on this tab, so filtering by it here would trap
  // the Plenum dropdown to always resolve back to the default model no matter
  // what the user picks.
  const isDedicatedDataset = (d: CalcDataset) =>
    d.signature?.type === "area_factors" ||
    d.signature?.type === "performance_data" ||
    d.columns.some((c) => c.key === "slot_width_in") ||
    (d.columns.some((c) => c.key === "size_mm") &&
      d.columns.some((c) => c.key.startsWith("air_flow")));

  const visible = useMemo(
    () =>
      (data?.datasets ?? []).filter(
        (d) => isDedicatedDataset(d) || signatureMatches(d.signature, selection),
      ),
    [data, selection],
  );

  const isAdjustableGrille = useMemo(() => {
    return visible.some(d => d.signature?.type === "area_factors") && visible.some(d => d.signature?.type === "performance_data");
  }, [visible]);

  const grilleIds = useMemo(() => {
    return new Set(isAdjustableGrille ? visible.filter(d => d.signature?.type === "area_factors" || d.signature?.type === "performance_data").map(d => d.id) : []);
  }, [isAdjustableGrille, visible]);

  const isSlotDiffuser = useMemo(() => {
    return ["nsd", "sd", "hcs"].includes(productId) || visible.some(d =>
      d.columns.some(c => c.key === "slot_width_in")
    );
  }, [productId, visible]);

  const slotDiffuserDatasetIds = useMemo(() => {
    return new Set(isSlotDiffuser ? visible.filter(d =>
      d.columns.some(c => c.key === "cfm_per_ft" || c.key.includes("cfm"))
    ).map(d => d.id) : []);
  }, [isSlotDiffuser, visible]);

  const isJetNozzle = useMemo(() => {
    return productId === "jnz" || visible.some(d =>
      d.columns.some(c => c.key === "size_mm") && d.columns.some(c => c.key.startsWith("air_flow"))
    );
  }, [productId, visible]);

  const jetNozzleDatasetIds = useMemo(() => {
    return new Set(isJetNozzle ? visible.filter(d =>
      d.columns.some(c => c.key === "size_mm") && d.columns.some(c => c.key.startsWith("air_flow"))
    ).map(d => d.id) : []);
  }, [isJetNozzle, visible]);

  // Damper-style "velocity vs pressure drop" datasets (no air-flow column,
  // duct size as sibling rows) with no explicit display override drive the
  // single custom Height/Width/CFM calculator instead of the per-dataset
  // switch below — an explicit admin chart mode still wins (§5 precedence).
  // Datasets already claimed by a dedicated calculator (grille/slot-diffuser/
  // jet-nozzle) are excluded so they don't also render here — e.g. jet nozzle
  // rows carry a velocity + Pa pressure column shape that would otherwise
  // false-match the damper heuristic.
  const damperDatasets = useMemo(
    () =>
      visible.filter(
        (d) =>
          !d.chart?.mode &&
          !grilleIds.has(d.id) &&
          !slotDiffuserDatasetIds.has(d.id) &&
          !jetNozzleDatasetIds.has(d.id) &&
          analyzeDamperVelocity(d) != null,
      ),
    [visible, grilleIds, slotDiffuserDatasetIds, jetNozzleDatasetIds],
  );
  const damperIds = useMemo(
    () => new Set(damperDatasets.map((d) => d.id)),
    [damperDatasets],
  );

  const remaining = useMemo(
    () => visible.filter((d) => !damperIds.has(d.id) && !grilleIds.has(d.id) && !slotDiffuserDatasetIds.has(d.id) && !jetNozzleDatasetIds.has(d.id)),
    [visible, damperIds, grilleIds, slotDiffuserDatasetIds, jetNozzleDatasetIds],
  );

  if (isLoading) return <CalcSkeleton />;

  if (!data || data.datasets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No performance data is available for this product yet.
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No performance data matches the selected configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {isAdjustableGrille && (
        <AdjustableGrilleCalculator
          datasets={visible}
          productId={productId}
        />
      )}
      {isSlotDiffuser && (
        <SlotDiffuserCalculator
          datasets={visible}
          productId={productId}
        />
      )}
      {isJetNozzle && (
        <JetNozzleCalculator
          datasets={visible}
          productId={productId}
        />
      )}
      {damperDatasets.length > 0 && (
        <DamperVelocityCalculator
          datasets={damperDatasets}
          productId={productId}
          hideInputs={isAdjustableGrille}
        />
      )}
      {remaining.map((ds) =>
        // Explicit admin display choice wins over the column heuristics.
        ds.chart?.mode === "table" ? (
          <DataTable key={ds.id} dataset={ds} />
        ) : ds.chart?.mode === "graph" ? (
          <ConfiguredChartCard key={ds.id} dataset={ds} />
        ) : ds.chart?.mode === "both" ? (
          <div key={ds.id} className="space-y-5">
            <ConfiguredChartCard dataset={ds} />
            <DataTable dataset={ds} />
          </div>
        ) : isOctaveBands(ds) ? (
          <FrequencyChartCard key={ds.id} dataset={ds} />
        ) : isSpectrum(ds) ? (
          <SpectrumTable key={ds.id} dataset={ds} />
        ) : (
          <DatasetCard key={ds.id} dataset={ds} productId={productId} />
        ),
      )}

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Values are interpolated at the air flow set in the Parameters panel
          and may vary with the installation environment.
        </span>
      </div>
    </div>
  );
}

/**
 * One dataset rendered as an operating-point calculator driven by the size and
 * air flow chosen in the Parameters panel: a pressure-drop chart, a throw chart,
 * and an interpolated parameter readout. Datasets without an air-flow column
 * (e.g. AK factor) fall back to a plain reference table.
 */
function DatasetCard({
  dataset,
  productId,
}: {
  dataset: CalcDataset;
  productId: string;
}) {
  const analysis = useMemo(() => analyze(dataset), [dataset]);

  if (!analysis) return <DataTable dataset={dataset} />;
  return <Calculator dataset={dataset} a={analysis} productId={productId} />;
}

function Calculator({
  dataset,
  a,
  productId,
}: {
  dataset: CalcDataset;
  a: Analysis;
  productId: string;
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId];

  const groups = useMemo(() => groupValues(dataset, a), [dataset, a]);
  const group =
    calc?.group && groups.includes(calc.group) ? calc.group : (groups[0] ?? "");

  const rows = useMemo(
    () => rowsForGroup(dataset, a, group),
    [dataset, a, group],
  );
  const [xMin, xMax] = airflowExtent(rows, a);

  // Local operating-point kept in state so the chart dot moves instantly on
  // every drag event without waiting for a URL round-trip. URL (and therefore
  // the readout table + Parameters panel) is written only after the user pauses
  // dragging for 150 ms, keeping re-renders to one per drag gesture.
  const urlAirflow =
    calc?.airflow != null
      ? Math.min(xMax, Math.max(xMin, calc.airflow))
      : (xMin + xMax) / 2;
  const [opAirflow, setOpAirflow] = useState(urlAirflow);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the URL value changes from outside (e.g.
  // parameter-panel input or page load) but don't stomp an in-progress drag.
  useEffect(() => {
    setOpAirflow(urlAirflow);
  }, [urlAirflow]);

  // Cancel pending URL write on unmount.
  useEffect(
    () => () => {
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    },
    [],
  );

  const calcLengthMm = calc?.lengthMm;
  const onDrag = (v: number) => {
    const rounded = xMax - xMin >= 50 ? Math.round(v) : Math.round(v * 10) / 10;
    const clamped = Math.min(xMax, Math.max(xMin, rounded));
    // Move chart dot immediately.
    setOpAirflow(clamped);
    // Debounce the URL write so only one re-render fires per drag gesture.
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    dragTimerRef.current = setTimeout(() => {
      const patch: Parameters<typeof setCalc>[1] = { airflow: clamped };
      if (calcLengthMm)
        patch.totalCfm = Math.round(clamped * (calcLengthMm / 304.8));
      setCalc(productId, patch);
    }, 150);
  };

  // Build a {x,y} curve for a given column across the active group's rows.
  const curve = (col: CalcColumn) =>
    rows
      .map((r) => ({ x: num(r[a.airflow.key]), y: num(r[col.key]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((p, q) => p.x - q.x);

  const pressureCurve = a.pressure ? curve(a.pressure) : [];
  const pressureAtOp = a.pressure
    ? interp(pressureCurve, opAirflow)
    : Number.NaN;

  // Right chart shows a SINGLE throw curve; the throw basis is chosen in the
  // Parameters panel. Falls back to NC where the dataset has no throw columns.
  const throwKey = resolveThrowKey(a, calc?.throwBasis, calc?.throwVel);
  const rightCol =
    a.throwCols.find((c) => c.key === throwKey) ?? a.throwCols[0] ?? a.ncCol;

  const rightCurve = rightCol ? curve(rightCol) : [];
  const rightSeries: ChartSeries[] = rightCol
    ? [{ name: rightCol.label, color: LINE, points: rightCurve }]
    : [];
  const rightAtOp = rightCol ? interp(rightCurve, opAirflow) : Number.NaN;
  const rightLabel = a.throwCols.length
    ? "Throw length"
    : (a.ncCol?.label ?? "");
  const rightUnit = rightCol?.unit ?? "";

  const readouts = a.readoutCols.map((c) => ({
    col: c,
    value: interp(curve(c), opAirflow),
  }));
  const areaVelocity =
    a.freeArea != null
      ? opAirflow / interp(curve(a.freeArea), opAirflow)
      : Number.NaN;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {a.pressure && (
          <Card className="gap-1 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">
              {a.pressure.label} vs {a.airflow.label}
            </p>
            <PerformanceChart
              series={[
                { name: a.pressure.label, color: LINE, points: pressureCurve },
              ]}
              xLabel={a.airflow.label}
              xUnit={a.airflow.unit}
              yLabel={a.pressure.label}
              yUnit={a.pressure.unit}
              operatingX={opAirflow}
              operatingY={pressureAtOp}
              operatingDots={[{ x: opAirflow, y: pressureAtOp, color: LINE }]}
              editable
              onOperatingXChange={onDrag}
              xDomainMin={xMin}
              xDomainMax={xMax}
            />
          </Card>
        )}

        {rightSeries.length > 0 && (
          <Card className="gap-1 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">
              {rightCol?.label ?? rightLabel} vs {a.airflow.label}
            </p>
            <PerformanceChart
              series={rightSeries}
              xLabel={a.airflow.label}
              xUnit={a.airflow.unit}
              yLabel={rightLabel}
              yUnit={rightUnit}
              operatingX={opAirflow}
              operatingY={rightAtOp}
              operatingDots={[{ x: opAirflow, y: rightAtOp, color: LINE }]}
              editable
              onOperatingXChange={onDrag}
              xDomainMin={xMin}
              xDomainMax={xMax}
            />
          </Card>
        )}
      </div>

      {/* Interpolated parameter readout at the selected air flow */}
      {(() => {
        const items = groupReadoutsByLabel([
          ...(a.groupCol ? [{ label: a.groupCol.label, value: group, unit: a.groupCol.unit }] : []),
          { label: a.airflow.label, value: fmt(opAirflow), unit: a.airflow.unit },
          ...(Number.isFinite(areaVelocity)
            ? [{ label: "Free area velocity", value: fmt(areaVelocity), unit: "fpm" }]
            : []),
          ...readouts.map(({ col, value }) => ({ label: col.label, value: fmt(value), unit: col.unit })),
        ]);
        return (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <ReadoutTableHead />
              <tbody>
                {items.map((item) => (
                  <ReadoutRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    unit={item.unit}
                    variants={item.variants}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Custom operating-point calculator for damper-style datasets: velocity vs
 * pressure drop, with duct size as separate sibling datasets (rows) rather
 * than a dataset column. Takes Height/Width/Airflow inputs, derives the
 * target face velocity, picks the published duct size closest to the
 * entered size (by equivalent square side), and interpolates that size's
 * curve at the target velocity.
 */
function DamperVelocityCalculator({
  productId,
  datasets,
  hideInputs = false,
}: {
  productId: string;
  datasets: CalcDataset[];
  hideInputs?: boolean;
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId];

  const analyzed = useMemo(
    () =>
      datasets
        .map((ds) => ({ ds, a: analyzeDamperVelocity(ds) }))
        .filter(
          (x): x is { ds: CalcDataset; a: DamperVelocityAnalysis } => !!x.a,
        ),
    [datasets],
  );

  const heightMm = calc?.heightMm ?? 0;
  const widthMm = calc?.widthMm ?? 0;
  const cfm = calc?.airflow ?? 0;

  const areaFt2 =
    heightMm > 0 && widthMm > 0 ? ductAreaFt2(widthMm, heightMm) : 0;
  const targetVelocity = areaFt2 > 0 && cfm > 0 ? cfm / areaFt2 : Number.NaN;
  const targetSide = Math.sqrt(widthMm * heightMm);

  const chosen = useMemo(() => {
    if (analyzed.length === 0) return null;
    if (!(targetSide > 0)) return analyzed[0];
    const sideOf = (x: (typeof analyzed)[number]) =>
      x.a.sizeMm
        ? Math.sqrt(x.a.sizeMm.w * x.a.sizeMm.h)
        : Number.POSITIVE_INFINITY;
    return analyzed.reduce((best, cur) =>
      Math.abs(sideOf(cur) - targetSide) < Math.abs(sideOf(best) - targetSide)
        ? cur
        : best,
    );
  }, [analyzed, targetSide]);

  if (!chosen) return null;
  const { ds, a } = chosen;

  const curve = ds.rows
    .map((r) => ({
      x: num(r[a.velocityCol.key]),
      y: num(r[a.pressureCol.key]),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((p, q) => p.x - q.x);

  const xMin = curve[0]?.x ?? 0;
  const xMax = curve[curve.length - 1]?.x ?? 1;
  const opVelocity = Number.isFinite(targetVelocity)
    ? Math.min(xMax, Math.max(xMin, targetVelocity))
    : Number.NaN;
  const pressureAtOp = Number.isFinite(opVelocity)
    ? interp(curve, opVelocity)
    : Number.NaN;

  return (
    <div className="space-y-5">
      {!hideInputs && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <span className="text-xs font-normal text-muted-foreground">
              Height (mm)
            </span>
            <FreeNumberInput
              label="Height (mm)"
              value={heightMm || ""}
              onCommit={(v) => setCalc(productId, { heightMm: v })}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-normal text-muted-foreground">
              Width (mm)
            </span>
            <FreeNumberInput
              label="Width (mm)"
              value={widthMm || ""}
              onCommit={(v) => setCalc(productId, { widthMm: v })}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-normal text-muted-foreground">
              Airflow (CFM)
            </span>
            <FreeNumberInput
              label="Airflow (CFM)"
              value={cfm || ""}
              onCommit={(v) => setCalc(productId, { airflow: v })}
            />
          </div>
        </div>
      )}

      <Card className="gap-1 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          {a.pressureCol.label} vs {a.velocityCol.label}
        </p>
        <PerformanceChart
          series={[{ name: a.pressureCol.label, color: LINE, points: curve }]}
          xLabel={a.velocityCol.label}
          xUnit={a.velocityCol.unit}
          yLabel={a.pressureCol.label}
          yUnit={a.pressureCol.unit}
          operatingX={opVelocity}
          operatingY={pressureAtOp}
          operatingDots={
            Number.isFinite(opVelocity)
              ? [{ x: opVelocity, y: pressureAtOp, color: LINE }]
              : []
          }
          xDomainMin={xMin}
          xDomainMax={xMax}
        />
      </Card>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <ReadoutTableHead />
          <tbody>
            <ReadoutRow
              label="Duct free area"
              value={areaFt2 > 0 ? fmt(areaFt2) : "—"}
              unit="ft²"
            />
            <ReadoutRow
              label="Air velocity"
              value={Number.isFinite(opVelocity) ? fmt(opVelocity) : "—"}
              unit={a.velocityCol.unit}
            />
            <ReadoutRow
              label={a.pressureCol.label}
              value={Number.isFinite(pressureAtOp) ? fmt(pressureAtOp) : "—"}
              unit={a.pressureCol.unit}
            />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Nearest published duct size used: {ds.label ?? "—"}
        {a.sizeMm ? ` (${a.sizeMm.w} × ${a.sizeMm.h} mm)` : ""}.
      </p>
    </div>
  );
}

/**
 * Compact data table for engineering datasets. Small type + tight padding so
 * wide/long tables fit more data on screen; long tables scroll within a fixed
 * height.
 */
function DataTable({ dataset }: { dataset: CalcDataset }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-primary">
        {dataset.label}
      </div>
      <div className="scrollbar-thin max-h-[26rem] overflow-auto">
        <table className="w-full text-[11px] leading-tight">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              {dataset.columns.map((c, i) => (
                <th
                  key={c.key}
                  className={cn(
                    // Left-aligned headers with a divider between columns.
                    "whitespace-nowrap px-2.5 py-1.5 text-left font-semibold text-foreground",
                    i > 0 && "border-l",
                  )}
                >
                  {c.label}
                  {c.unit ? (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({c.unit})
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((r, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: positional data rows
                key={i}
                className="border-b last:border-0 odd:bg-muted/20"
              >
                {dataset.columns.map((c, ci) => (
                  <td
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-2.5 py-1 text-left text-foreground",
                      c.type !== "text" && "tabular-nums",
                      ci > 0 && "border-l",
                    )}
                  >
                    {r[c.key] == null ? "—" : String(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Octave-band sound power rendered as a frequency-response chart: frequency
 * (Hz, log axis) on X, sound power (dB) on Y, one line per unit size. The
 * underlying table follows for exact values. Drives the AHRI radiated/discharge
 * sound datasets where the bands are columns and each row is a unit size.
 */
function FrequencyChartCard({ dataset }: { dataset: CalcDataset }) {
  const freqs = useMemo(() => freqColumns(dataset), [dataset]);
  // Label each line by the first text column (the unit size), else row number.
  const labelCol = dataset.columns.find((c) => c.type === "text");

  const series: ChartSeries[] = dataset.rows.map((r, i) => ({
    name: labelCol ? String(r[labelCol.key] ?? `#${i + 1}`) : `#${i + 1}`,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: freqs
      .map(({ col, hz }) => ({ x: hz, y: num(r[col.key]) }))
      .filter((p) => Number.isFinite(p.y)),
  }));

  return (
    <Card className="gap-1 px-4 py-4">
      <p className="text-sm font-semibold text-foreground">{dataset.label}</p>
      <PerformanceChart
        series={series}
        xLabel="Frequency"
        xUnit="Hz"
        yLabel="Sound power level"
        yUnit="dB"
        groupLabel={labelCol?.label ?? "Unit size"}
        logX
        height={340}
      />
    </Card>
  );
}

/**
 * A dataset an admin explicitly flagged as a graph. Honors the configured
 * `xKey`/`yKeys`, falling back to heuristics (first numeric column as X, the
 * remaining numeric columns as series). If no usable numeric axes exist, it
 * degrades to the plain table rather than rendering an empty chart.
 */
function ConfiguredChartCard({ dataset }: { dataset: CalcDataset }) {
  const numeric = dataset.columns.filter((c) => c.type !== "text");
  const xCol =
    dataset.columns.find((c) => c.key === dataset.chart?.xKey) ??
    numeric[0] ??
    dataset.columns[0];

  const yCols: CalcColumn[] =
    dataset.chart?.yKeys && dataset.chart.yKeys.length > 0
      ? dataset.chart.yKeys
          .map((k) => dataset.columns.find((c) => c.key === k))
          .filter((c): c is CalcColumn => !!c && c.key !== xCol?.key)
      : numeric.filter((c) => c.key !== xCol?.key);

  const series: ChartSeries[] = yCols.map((yc, i) => ({
    name: yc.unit ? `${yc.label} (${yc.unit})` : yc.label,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: dataset.rows
      .map((r) => ({ x: num(r[xCol?.key ?? ""]), y: num(r[yc.key]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x),
  }));

  // No numeric X, or no series with plottable points → show the table instead.
  if (!xCol || series.every((s) => s.points.length === 0)) {
    return <DataTable dataset={dataset} />;
  }

  return (
    <Card className="gap-1 px-4 py-4">
      <p className="text-sm font-semibold text-foreground">{dataset.label}</p>
      <PerformanceChart
        series={series}
        xLabel={xCol.label}
        xUnit={xCol.unit}
        yLabel={yCols.length === 1 ? yCols[0].label : "Value"}
        yUnit={yCols.length === 1 ? yCols[0].unit : undefined}
        groupLabel={yCols.length > 1 ? "Series" : undefined}
        height={340}
      />
    </Card>
  );
}

function SpectrumTable({ dataset }: { dataset: CalcDataset }) {
  const [bandCol, ...seriesCols] = dataset.columns;
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-primary">
        {dataset.label}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-2 text-left font-medium text-muted-foreground">
                {bandCol?.label ?? "Hz"}
              </td>
              {dataset.rows.map((r, i) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional band header
                  key={i}
                  className="border-l px-3 py-2 text-left font-medium text-muted-foreground tabular-nums"
                >
                  {String(r[bandCol?.key ?? ""] ?? "")}
                </td>
              ))}
            </tr>
            {seriesCols.map((sc) => (
              <tr key={sc.key} className="border-b last:border-0">
                <td className="px-3 py-2 text-left text-foreground">
                  <span className="font-semibold">{sc.label}</span>{" "}
                  <span className="text-muted-foreground">{sc.unit}</span>
                </td>
                {dataset.rows.map((r, i) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional band value
                    key={i}
                    className="border-l px-3 py-2 text-left tabular-nums text-foreground"
                  >
                    {String(r[sc.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", !open && "-rotate-90")}
        />
        {title}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function CalcSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
