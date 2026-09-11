"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import { Card } from "@/components/ui";
import { type CalcDataset, useCatalogParams } from "@/features/catalog";
import { interp, num } from "./calc-utils";
import { type ChartSeries, PerformanceChart } from "./performance-chart";
import { FreeNumberInput } from "./product-config-panel";

/** One line per blade deflection angle, so both settings compare at a glance. */
const ANGLE_COLOR: Record<string, string> = { "0": "#2563eb", "45": "#dc2626" };

/** Renders the Width/Height/Airflow inputs for Adjustable Grille in the sidebar. */
export function AdjustableGrilleParameters({
  productId,
  hideAirflow = false,
}: {
  productId: string;
  /** Dimensions tab needs Width/Height only — Airflow doesn't affect the drawing. */
  hideAirflow?: boolean;
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId];

  const widthMm = calc?.widthMm ?? 0;
  const heightMm = calc?.heightMm ?? 0;
  const cfm = calc?.airflow ?? 0;

  return (
    <>
      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Width (mm)</span>
        <FreeNumberInput
          label="Width (mm)"
          value={widthMm || ""}
          onCommit={(v) => setCalc(productId, { widthMm: v })}
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Height (mm)</span>
        <FreeNumberInput
          label="Height (mm)"
          value={heightMm || ""}
          onCommit={(v) => setCalc(productId, { heightMm: v })}
        />
      </div>
      {!hideAirflow && (
        <div className="space-y-1">
          <span className="text-xs font-normal text-muted-foreground">Airflow (CFM)</span>
          <FreeNumberInput
            label="Airflow (CFM)"
            value={cfm || ""}
            onCommit={(v) => setCalc(productId, { airflow: v })}
          />
        </div>
      )}
    </>
  );
}

export function AdjustableGrilleCalculator({
  productId,
  datasets,
}: {
  productId: string;
  datasets: CalcDataset[];
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId];

  const widthMm = calc?.widthMm ?? 0;
  const heightMm = calc?.heightMm ?? 0;
  const cfm = calc?.airflow ?? 0;

  const targetWidthInches = widthMm / 25.4;
  const targetHeightInches = heightMm / 25.4;

  const areaFactorsDs = datasets.find((d) => d.signature?.type === "area_factors");
  const performanceDs = datasets.find((d) => d.signature?.type === "performance_data");

  // Nearest match logic
  const getClosestNumber = (target: number, arr: number[]) => {
    if (arr.length === 0) return 0;
    return arr.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );
  };

  const availableWidths = useMemo(() => {
    if (!areaFactorsDs) return [];
    const widths = new Set(areaFactorsDs.rows.map((r) => num(r.width)));
    return Array.from(widths).filter(Number.isFinite).sort((a, b) => a - b);
  }, [areaFactorsDs]);

  const closestWidthInches = targetWidthInches > 0 ? getClosestNumber(targetWidthInches, availableWidths) : null;

  const availableHeights = useMemo(() => {
    if (!areaFactorsDs || !closestWidthInches) return [];
    const heights = areaFactorsDs.rows
      .filter((r) => num(r.width) === closestWidthInches)
      .map((r) => num(r.length)); // In DB it is "length"
    return heights.filter(Number.isFinite).sort((a, b) => a - b);
  }, [areaFactorsDs, closestWidthInches]);

  const closestHeightInches = targetHeightInches > 0 ? getClosestNumber(targetHeightInches, availableHeights) : null;

  const areaFactorRow = useMemo(() => {
    if (!areaFactorsDs || !closestWidthInches || !closestHeightInches) return null;
    return areaFactorsDs.rows.find(
      (r) => num(r.width) === closestWidthInches && num(r.length) === closestHeightInches
    );
  }, [areaFactorsDs, closestWidthInches, closestHeightInches]);

  const areaFactor = areaFactorRow ? num(areaFactorRow.area_factor) : null;

  const closestPerfAreaFactor = useMemo(() => {
    if (!performanceDs || !areaFactor) return null;
    const perfAFs = new Set(performanceDs.rows.map((r) => num(r.area_factor)));
    return getClosestNumber(areaFactor, Array.from(perfAFs).filter(Number.isFinite));
  }, [performanceDs, areaFactor]);

  const isSnapped =
    (targetWidthInches > 0 && Math.abs(targetWidthInches - closestWidthInches!) > 0.1) ||
    (targetHeightInches > 0 && Math.abs(targetHeightInches - closestHeightInches!) > 0.1);

  // CFM Logic
  const availableCfms = useMemo(() => {
    if (!performanceDs || !closestPerfAreaFactor) return [];
    const cfms = new Set(
      performanceDs.rows
        .filter((r) => num(r.area_factor) === closestPerfAreaFactor)
        .map((r) => num(r.cfm))
    );
    return Array.from(cfms).filter(Number.isFinite).sort((a, b) => a - b);
  }, [performanceDs, closestPerfAreaFactor]);

  const closestCfm = cfm > 0 && availableCfms.length > 0 ? getClosestNumber(cfm, availableCfms) : null;

  // Guardrail: the published table for a given size only covers a specific
  // airflow range (a small grille simply has no data for a huge CFM). Rather
  // than silently clamping to the edge value, flag it so the reading isn't
  // mistaken for the actual figure at the entered airflow.
  const minCfm = availableCfms[0] ?? null;
  const maxCfm = availableCfms[availableCfms.length - 1] ?? null;
  const isCfmOutOfRange =
    cfm > 0 && minCfm != null && maxCfm != null && (cfm < minCfm || cfm > maxCfm);

  const cfmsToShow = useMemo(() => {
    if (!closestCfm || availableCfms.length === 0) return [];
    return [closestCfm];
  }, [closestCfm, availableCfms]);

  const tableRows = useMemo(() => {
    if (!performanceDs || !closestPerfAreaFactor || cfmsToShow.length === 0) return [];
    const rows: {
      cfm: number;
      angle: string;
      tMin: number | null;
      tMax: number | null;
      sp: number | null;
      nc: string | null;
    }[] = [];

    const angles = ["0", "22.5", "45"];
    
    for (const c of cfmsToShow) {
      for (const a of angles) {
        const row = performanceDs.rows.find(
          (r) =>
            num(r.area_factor) === closestPerfAreaFactor &&
            num(r.cfm) === c &&
            String(r.spread_angle) === a
        );
        if (row) {
          rows.push({
            cfm: c,
            angle: a === "22.5" ? "22½°" : a + "°",
            tMin: row.throw_min != null ? num(row.throw_min) : null,
            tMax: row.throw_max != null ? num(row.throw_max) : null,
            sp: row.static_pressure != null ? num(row.static_pressure) : null,
            nc: row.nc != null ? String(row.nc) : null,
          });
        }
      }
    }
    return rows;
  }, [performanceDs, areaFactor, cfmsToShow]);

  const closestWidthMm = closestWidthInches != null ? Math.round(closestWidthInches * 25.4) : null;
  const closestHeightMm = closestHeightInches != null ? Math.round(closestHeightInches * 25.4) : null;

  // Full curves (all published CFM points, not just the closest one) for the
  // resolved size — one line per blade deflection angle, so the two settings
  // compare at a glance instead of only reading a single snapped row.
  const buildCurve = (key: "static_pressure" | "throw_max") =>
    ["0", "45"]
      .map((angle) => ({
        angle,
        points: (performanceDs?.rows ?? [])
          .filter(
            (r) => num(r.area_factor) === closestPerfAreaFactor && String(r.spread_angle) === angle,
          )
          .map((r) => ({ x: num(r.cfm), y: num(r[key]) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => a.x - b.x),
      }))
      .filter((c) => c.points.length > 0);

  const pressureCurves = useMemo(
    () => (performanceDs && closestPerfAreaFactor ? buildCurve("static_pressure") : []),
    [performanceDs, closestPerfAreaFactor],
  );
  const throwCurves = useMemo(
    () => (performanceDs && closestPerfAreaFactor ? buildCurve("throw_max") : []),
    [performanceDs, closestPerfAreaFactor],
  );

  // Operating point for the charts: the entered airflow clamped to the
  // published range (continuous), independent of the table's discrete
  // nearest-CFM row — lets the chart read smoothly between catalog points.
  const opAirflow =
    minCfm != null && maxCfm != null
      ? cfm > 0
        ? Math.min(maxCfm, Math.max(minCfm, cfm))
        : (minCfm + maxCfm) / 2
      : null;

  return (
    <div className="space-y-6 pb-8">
      {isSnapped && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Not a listed standard size:</strong> {widthMm} × {heightMm} mm isn't published — showing the
            nearest listed size, {closestWidthMm} × {closestHeightMm} mm.
          </span>
        </div>
      )}

      {isCfmOutOfRange && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Airflow out of published range:</strong> {cfm} CFM is outside {minCfm}–{maxCfm} CFM for this
            size — showing the nearest published value, {closestCfm} CFM.
          </span>
        </div>
      )}

      {areaFactor != null && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
          <span className="text-sm font-semibold">Catalog Size Area Factor:</span>
          <span className="text-lg font-bold">{areaFactor}</span>
        </div>
      )}

      {opAirflow != null && (pressureCurves.length > 0 || throwCurves.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {pressureCurves.length > 0 && (
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Static Pressure vs Airflow</p>
              <PerformanceChart
                series={pressureCurves.map(
                  (c): ChartSeries => ({
                    name: `${c.angle}°`,
                    color: ANGLE_COLOR[c.angle] ?? "#2563eb",
                    points: c.points,
                  }),
                )}
                xLabel="Airflow"
                xUnit="CFM"
                yLabel="Static Pressure"
                yUnit="mmH₂O"
                operatingX={opAirflow}
                operatingDots={pressureCurves.map((c) => ({
                  x: opAirflow,
                  y: interp(c.points, opAirflow),
                  color: ANGLE_COLOR[c.angle] ?? "#2563eb",
                }))}
                editable
                onOperatingXChange={(v) => setCalc(productId, { airflow: v })}
                xDomainMin={minCfm ?? 0}
                xDomainMax={maxCfm ?? 1}
              />
            </Card>
          )}

          {throwCurves.length > 0 && (
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Throw (Max) vs Airflow</p>
              <PerformanceChart
                series={throwCurves.map(
                  (c): ChartSeries => ({
                    name: `${c.angle}°`,
                    color: ANGLE_COLOR[c.angle] ?? "#2563eb",
                    points: c.points,
                  }),
                )}
                xLabel="Airflow"
                xUnit="CFM"
                yLabel="Throw (Max)"
                yUnit="m"
                operatingX={opAirflow}
                operatingDots={throwCurves.map((c) => ({
                  x: opAirflow,
                  y: interp(c.points, opAirflow),
                  color: ANGLE_COLOR[c.angle] ?? "#2563eb",
                }))}
                editable
                onOperatingXChange={(v) => setCalc(productId, { airflow: v })}
                xDomainMin={minCfm ?? 0}
                xDomainMax={maxCfm ?? 1}
              />
            </Card>
          )}
        </div>
      )}

      {(
        <div className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-primary">
            Sectional Performance Data
          </div>
          <div className="scrollbar-thin max-h-[26rem] overflow-auto">
            <table className="w-full text-[13px] leading-tight">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <th className="whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">CFM</th>
                  <th className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">Spread Angle</th>
                  <th className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">Throw Min (m)</th>
                  <th className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">Throw Max (m)</th>
                  <th className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">Static Pressure (mmH₂O)</th>
                  <th className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">Noise (NC)</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Please enter parameters to view data.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r, i) => {
                    const isClosest = r.cfm === closestCfm;
                    const isFirstOfCfm = i % 3 === 0;
                    return (
                      <tr
                        key={i}
                        className={`border-b last:border-0 ${
                          isClosest ? "bg-blue-500/10 dark:bg-blue-500/20" : "odd:bg-muted/20"
                        }`}
                      >
                        {isFirstOfCfm && (
                          <td
                            rowSpan={3}
                            className="whitespace-nowrap px-4 py-2 text-left font-bold text-foreground align-middle"
                          >
                            {r.cfm}
                          </td>
                        )}
                        <td className="border-l whitespace-nowrap px-4 py-2 text-left font-semibold text-foreground">
                          {r.angle}
                        </td>
                        <td className="border-l whitespace-nowrap px-4 py-2 text-left text-foreground">
                          {r.tMin != null ? r.tMin : "—"}
                        </td>
                        <td className="border-l whitespace-nowrap px-4 py-2 text-left text-foreground">
                          {r.tMax != null ? r.tMax : "—"}
                        </td>
                        <td className="border-l whitespace-nowrap px-4 py-2 text-left text-foreground tabular-nums">
                          {r.sp != null ? r.sp : "—"}
                        </td>
                        <td className="border-l whitespace-nowrap px-4 py-2 text-left text-foreground tabular-nums">
                          {r.nc != null ? r.nc : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
