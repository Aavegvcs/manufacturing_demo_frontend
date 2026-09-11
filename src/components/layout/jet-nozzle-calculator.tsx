"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { type CalcColumn, type CalcDataset, useCatalogParams } from "@/features/catalog";
import { FreeNumberInput } from "./product-config-panel";
import { num } from "./calc-utils";
import { type ReadoutVariant, ReadoutRow, ReadoutTableHead } from "./readout-table";

/** One published installation condition (e.g. "Duct Installation"), with the
 * Static Pressure / NC columns that apply to it. Jet nozzle publishes the
 * same two readouts once per installation type — this groups the columns so
 * the calculator can show just the active type's pair instead of all of them
 * at once. */
interface InstallationType {
  key: string;
  label: string;
  pressureCol?: CalcColumn;
  ncCol?: CalcColumn;
}

/** Detects `<type>_sp_pa` / `<type>_nc` column pairs and groups them by type,
 * e.g. `duct_sp_pa`/`duct_nc` → "Duct Installation". Labels the group from
 * the column's own "(... Installation)" parenthetical so it stays in sync
 * with whatever the admin has actually named it. */
function installationTypes(columns: CalcColumn[]): InstallationType[] {
  const byKey = new Map<string, InstallationType>();
  const labelOf = (c: CalcColumn, fallback: string) =>
    /\(([^)]+)\)/.exec(c.label)?.[1] ?? fallback;

  for (const c of columns) {
    const pressure = /^(.+)_sp_pa$/.exec(c.key);
    const nc = !pressure ? /^(.+)_nc$/.exec(c.key) : null;
    const key = pressure?.[1] ?? nc?.[1];
    if (!key) continue;
    const entry = byKey.get(key) ?? { key, label: key };
    if (pressure) {
      entry.pressureCol = c;
      entry.label = labelOf(c, entry.label);
    } else if (nc) {
      entry.ncCol = c;
      if (!byKey.has(key)) entry.label = labelOf(c, entry.label);
    }
    byKey.set(key, entry);
  }
  return Array.from(byKey.values());
}

/**
 * Gets the valid datasets, available nozzle sizes, and mounting heights for
 * jet nozzles. Each dataset is one published "throw" table (e.g. 8m / 16m /
 * 25m throw) — the mounting Height picks which of those tables to read from,
 * since the required throw distance tracks the room/mounting height.
 */
function useJetNozzleOptions(datasets: CalcDataset[]) {
  const performanceDatasets = useMemo(
    () =>
      datasets.filter(
        (d) =>
          d.columns.some((c) => c.key === "size_mm") &&
          d.columns.some((c) => c.key.startsWith("air_flow")),
      ),
    [datasets],
  );

  const availableSizes = useMemo(() => {
    const sizes = new Set<number>();
    for (const ds of performanceDatasets) {
      for (const r of ds.rows) {
        const val = num(r.size_mm);
        if (Number.isFinite(val)) sizes.add(val);
      }
    }
    return Array.from(sizes).sort((a, b) => a - b);
  }, [performanceDatasets]);

  const heightOptions = useMemo(() => {
    return performanceDatasets
      .map((ds) => {
        const fromSignature = Number(ds.signature?.throw_m);
        if (Number.isFinite(fromSignature)) {
          return { id: ds.id, height: fromSignature };
        }
        const m = ds.label.match(/(\d+(?:\.\d+)?)\s*m\s*throw/i);
        return m ? { id: ds.id, height: Number(m[1]) } : null;
      })
      .filter((x): x is { id: string; height: number } => !!x)
      .sort((a, b) => a.height - b.height);
  }, [performanceDatasets]);

  return { performanceDatasets, availableSizes, heightOptions };
}

/** Renders the inputs for Jet Nozzle in the sidebar. */
export function JetNozzleParameters({
  datasets,
  productId,
}: {
  datasets: CalcDataset[];
  productId: string;
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId] || {};
  const { performanceDatasets, availableSizes, heightOptions } = useJetNozzleOptions(datasets);

  // Reuses the slotsCount/totalCfm/plenumId/lengthMm calc fields (otherwise
  // unused by this product) instead of group/airflow/throwBasis/throwVel —
  // those are written by the generic operating-point "seed defaults" effect
  // in product-config-panel.tsx whenever any air-flow-shaped dataset is
  // active, which would otherwise fight the user's own inputs here.
  const size = calc.slotsCount ?? availableSizes[0] ?? 0;
  const airflow = calc.totalCfm ?? 0;
  const heightDatasetId = calc.plenumId ?? heightOptions[0]?.id;

  const hasCatalogueSize = performanceDatasets.some(ds => ds.columns.some(c => c.key === "size_label"));

  const activeDataset = performanceDatasets.find((d) => d.id === heightDatasetId) || performanceDatasets[0];
  const airflowCol = activeDataset?.columns.find((c) => c.key === "air_flow_cfm" || c.key.startsWith("air_flow"));
  let rows = activeDataset?.rows || [];
  if (size) rows = rows.filter((r) => num(r.size_mm) === Number(size));
  const airflows = rows.map((r) => num(r[airflowCol?.key ?? ""])).filter((v) => Number.isFinite(v));
  const minAirflow = airflows.length ? Math.min(...airflows) : undefined;
  const maxAirflow = airflows.length ? Math.max(...airflows) : undefined;

  const installTypes = useMemo(
    () => installationTypes(performanceDatasets[0]?.columns ?? []),
    [performanceDatasets],
  );
  const installIndex = Math.min(calc.lengthMm ?? 0, installTypes.length - 1);

  // Catalogue's own size code (e.g. "S1", "L8") for whichever `size` (mm) is
  // selected — informational only, so it lives in the sidebar next to the
  // Size dropdown instead of taking up a row in the results table.
  const catalogueSize = useMemo(() => {
    for (const ds of performanceDatasets) {
      if (!ds.columns.some((c) => c.key === "size_label")) continue;
      const row = ds.rows.find((r) => num(r.size_mm) === Number(size));
      if (row?.size_label != null) return String(row.size_label);
    }
    return null;
  }, [performanceDatasets, size]);

  return (
    <>
      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">{hasCatalogueSize ? "Catalogue Size" : "Size (Dia, mm)"}</span>
        <Select
          value={size ? size.toString() : ""}
          onValueChange={(v) => setCalc(productId, { slotsCount: Number(v) })}
        >
          <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select size" /></SelectTrigger>
          <SelectContent>
            {availableSizes.length > 0 ? (
              availableSizes.map((s) => {
                let text = `${s} mm`;
                if (hasCatalogueSize) {
                  let row = null;
                  for (const ds of performanceDatasets) {
                    row = ds.rows.find((r) => num(r.size_mm) === s);
                    if (row) break;
                  }
                  if (row) {
                    const label = row.size_label ?? s;
                    let w = row.width_mm ?? row.width ?? row.length_mm ?? row.length ?? row.duct_width_in;
                    let h = row.height_mm ?? row.height ?? row.duct_height_in;
                    
                    if (w == null || h == null) {
                      for (const ds of datasets) {
                        const dimRow = ds.rows.find((r) => r.size_label === label || num(r.size_mm) === s);
                        if (dimRow) {
                          w = w ?? dimRow.width_mm ?? dimRow.width ?? dimRow.length_mm ?? dimRow.length ?? dimRow.duct_width_in;
                          h = h ?? dimRow.height_mm ?? dimRow.height ?? dimRow.duct_height_in;
                          if (w != null && h != null) break;
                        }
                      }
                    }

                    if (w != null && h != null) {
                      text = `${label} - ${w}x${h}`;
                    } else if (label !== s) {
                      text = `${label} (${s} mm)`;
                    }
                  }
                }
                return (
                  <SelectItem key={s} value={s.toString()} className="text-xs">{text}</SelectItem>
                );
              })
            ) : (
              <SelectItem value="0" className="text-xs" disabled>No sizes published</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Air Flow (CFM)</span>
        <FreeNumberInput
          label="Air Flow (CFM)"
          value={airflow || ""}
          min={minAirflow}
          max={maxAirflow}
          onCommit={(v) => setCalc(productId, { totalCfm: v })}
        />
      </div>

      {heightOptions.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-normal text-muted-foreground">Height (m)</span>
          <Select
            value={heightDatasetId}
            onValueChange={(v) => setCalc(productId, { plenumId: v })}
          >
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select height" /></SelectTrigger>
            <SelectContent>
              {heightOptions.map((h) => (
                <SelectItem key={h.id} value={h.id} className="text-xs">{h.height} m</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {installTypes.length > 1 && (
        <div className="space-y-1">
          <span className="text-xs font-normal text-muted-foreground">Installation Type</span>
          <Select
            value={String(installIndex)}
            onValueChange={(v) => setCalc(productId, { lengthMm: Number(v) })}
          >
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select installation" /></SelectTrigger>
            <SelectContent>
              {installTypes.map((t, i) => (
                <SelectItem key={t.key} value={String(i)} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

/** Renders the single-row result table for Jet Nozzle in the main panel. */
export function JetNozzleCalculator({
  datasets,
  productId,
}: {
  datasets: CalcDataset[];
  productId: string;
}) {
  const { calc: calcMap } = useCatalogParams();
  const calc = calcMap[productId] || {};
  const { performanceDatasets, availableSizes, heightOptions } = useJetNozzleOptions(datasets);

  const size = calc.slotsCount ?? availableSizes[0] ?? 0;
  const airflow = calc.totalCfm ?? 0;

  const heightDatasetId = calc.plenumId ?? heightOptions[0]?.id;
  const activeDataset =
    performanceDatasets.find((d) => d.id === heightDatasetId) || performanceDatasets[0];

  if (!activeDataset) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        No performance data tables found for this product yet.
      </div>
    );
  }

  const airflowCol =
    activeDataset.columns.find((c) => c.key === "air_flow_cfm") ??
    activeDataset.columns.find((c) => c.key.startsWith("air_flow"));

  let rows = activeDataset.rows;
  if (size) {
    rows = rows.filter((r) => num(r.size_mm) === Number(size));
  }

  let singleRow = rows[0];
  if (airflow > 0 && airflowCol) {
    const withAirflow = rows.filter((r) => Number.isFinite(num(r[airflowCol.key])));
    if (withAirflow.length > 0) {
      singleRow = withAirflow.reduce((prev, curr) =>
        Math.abs(num(curr[airflowCol.key]) - airflow) < Math.abs(num(prev[airflowCol.key]) - airflow)
          ? curr
          : prev,
      );
    }
  }

  if (!singleRow) return null;

  const row = singleRow;
  const valueOf = (c: CalcColumn) => (row[c.key] == null ? "—" : String(row[c.key]));

  const installTypes = installationTypes(activeDataset.columns);
  const installIndex = Math.min(calc.lengthMm ?? 0, installTypes.length - 1);
  const activeInstall = installTypes[installIndex];
  const installCols = new Set(
    installTypes.flatMap((t) => [t.pressureCol?.key, t.ncCol?.key].filter((k): k is string => !!k)),
  );

  // Any column sharing the "Air Flow" label collapses into one row with a
  // unit-switch dropdown instead of one row per published unit.
  const airFlowCols = activeDataset.columns.filter((c) => c.label === "Air Flow");
  const airFlowKeys = new Set(airFlowCols.map((c) => c.key));

  const items: { key: string; label: string; value?: string; unit?: string; variants?: ReadoutVariant[] }[] = [];
  if (airFlowCols.length > 0) {
    items.push({
      key: "air_flow",
      label: "Air Flow",
      variants: airFlowCols.map((c) => ({ value: valueOf(c), unit: c.unit ?? "" })),
    });
  }
  for (const c of activeDataset.columns) {
    if (airFlowKeys.has(c.key)) continue;
    if (c.key === "size_label") continue; // shown in the Parameters panel instead
    if (activeInstall?.pressureCol?.key === c.key) {
      items.push({ key: c.key, label: "Static Pressure", value: valueOf(c), unit: c.unit ?? undefined });
      continue;
    }
    if (activeInstall?.ncCol?.key === c.key) {
      items.push({ key: c.key, label: "Noise Criteria (NC)", value: valueOf(c), unit: c.unit ?? undefined });
      continue;
    }
    if (installCols.has(c.key)) continue; // the non-active installation type's columns
    items.push({ key: c.key, label: c.label, value: valueOf(c), unit: c.unit ?? undefined });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-primary">
          {activeDataset.label}
          {size ? ` — ${size} mm` : ""}
          {activeInstall ? ` — ${activeInstall.label}` : ""}
        </div>
        <table className="w-full text-sm">
          <ReadoutTableHead />
          <tbody>
            {items.map((r) => (
              <ReadoutRow key={r.key} label={r.label} value={r.value} unit={r.unit} variants={r.variants} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
