"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { type CalcDataset, useCatalogParams } from "@/features/catalog";
import { FreeNumberInput } from "./product-config-panel";
import { num, type Row } from "./calc-utils";
import { groupReadoutsByLabel, ReadoutRow, ReadoutTableHead } from "./readout-table";

/** 
 * Gets the valid datasets, available gaps, and slot counts for slot diffusers.
 */
function useSlotDiffuserOptions(datasets: CalcDataset[]) {
  const performanceDatasets = useMemo(() => 
    datasets.filter((d) => d.columns.some((c) => c.key === "cfm_per_ft" || c.key.includes("cfm"))),
    [datasets]
  );

  const availableGaps = useMemo(() => {
    const gaps = new Set<number>();
    for (const ds of performanceDatasets) {
      const col = ds.columns.find((c) => c.key === "slot_width_in");
      if (!col) continue;
      for (const r of ds.rows) {
        const val = num(r[col.key]);
        if (Number.isFinite(val)) {
          gaps.add(Math.round(val * 25.4));
        }
      }
    }
    return Array.from(gaps).sort((a, b) => a - b);
  }, [performanceDatasets]);

  const availableSlots = useMemo(() => {
    const counts = new Set<number>();
    for (const ds of performanceDatasets) {
      const col = ds.columns.find((c) => c.key === "slots" || c.key === "slot_count");
      if (col) {
        for (const r of ds.rows) {
          const val = num(r[col.key]);
          if (Number.isFinite(val)) counts.add(val);
        }
      } else {
        const m = ds.label.match(/(\d+)\s*slot/i);
        if (m) counts.add(Number(m[1]));
      }
    }
    return Array.from(counts).sort((a, b) => a - b);
  }, [performanceDatasets]);

  return { performanceDatasets, availableGaps, availableSlots };
}

/**
 * The active model dataset is derived from the selected Slot Gap — each
 * dataset has a single, fixed slot width, so gap and model are a 1:1
 * relationship. There's deliberately no separate model/"Plenum" picker: two
 * independent controls for the same underlying choice can fall out of sync
 * (e.g. Slot Gap set to a width the currently-picked model doesn't have),
 * which used to render a blank result.
 */
function datasetForGap(
  performanceDatasets: CalcDataset[],
  slotGap: number | undefined,
): CalcDataset | undefined {
  if (slotGap == null) return performanceDatasets[0];
  const match = performanceDatasets.find((ds) => {
    const col = ds.columns.find((c) => c.key === "slot_width_in");
    if (!col) return false;
    return ds.rows.some((r) => Math.round(num(r[col.key]) * 25.4) === slotGap);
  });
  return match ?? performanceDatasets[0];
}

/** A dataset's rows filtered down to the current slot width + slot count. */
function rowsForConfig(
  ds: CalcDataset,
  slotGap: number | undefined,
  slotsCount: number | undefined,
): Row[] {
  const slotWidthCol = ds.columns.find((c) => c.key === "slot_width_in");
  const slotsCol = ds.columns.find((c) => c.key === "slots" || c.key === "slot_count");
  let rows = ds.rows;
  if (slotWidthCol && slotGap != null) {
    rows = rows.filter((r) => Math.round(num(r[slotWidthCol.key]) * 25.4) === slotGap);
  }
  if (slotsCol && slotsCount != null) {
    rows = rows.filter((r) => num(r[slotsCol.key]) === slotsCount);
  } else if (!slotsCol && slotsCount != null) {
    const m = ds.label.match(/(\d+)\s*slot/i);
    if (m && Number(m[1]) !== slotsCount) rows = [];
  }
  return rows;
}

/**
 * Suggests the minimum required length (ft) for the given total airflow: the
 * shortest length that still stays within the published CFM/ft range for the
 * current slot width + slot count — i.e. total CFM ÷ the highest published
 * rate. Shown automatically the moment airflow is entered, so the user never
 * has to guess a length up front.
 */
function suggestRequiredLength(
  ds: CalcDataset | undefined,
  cfmCol: { key: string } | undefined,
  slotGap: number | undefined,
  slotsCount: number | undefined,
  cfm: number,
): number | undefined {
  if (!ds || !cfmCol || !(cfm > 0)) return undefined;
  const rates = rowsForConfig(ds, slotGap, slotsCount)
    .map((r) => num(r[cfmCol.key]))
    .filter((v) => v > 0);
  if (rates.length === 0) return undefined;
  return Number((cfm / Math.max(...rates)).toFixed(2));
}

/**
 * Picks the row whose CFM/ft rate yields the shortest achievable length that
 * is still >= the requested length — i.e. the length is always rounded UP to
 * the nearest achievable option, never down, so the diffuser is never
 * undersized for the requested run. Falls back to the row with the smallest
 * rate (the longest achievable length) when every published rate would
 * require a length beyond what's requested.
 */
function rowForRequiredLength(
  rows: Row[],
  cfmCol: { key: string } | undefined,
  cfm: number,
  requiredLength: number,
): Row | undefined {
  if (rows.length === 0) return undefined;
  if (!cfmCol || !(cfm > 0) || !(requiredLength > 0)) return rows[0];
  const targetRate = cfm / requiredLength;
  const withRate = rows.filter((r) => num(r[cfmCol.key]) > 0);
  if (withRate.length === 0) return rows[0];
  const notExceeding = withRate.filter((r) => num(r[cfmCol.key]) <= targetRate);
  const pool = notExceeding.length > 0 ? notExceeding : withRate;
  const pickLargest = notExceeding.length > 0;
  return pool.reduce((best, r) => {
    const better = pickLargest
      ? num(r[cfmCol.key]) > num(best[cfmCol.key])
      : num(r[cfmCol.key]) < num(best[cfmCol.key]);
    return better ? r : best;
  });
}

/** 
 * Renders the inputs for Slot Diffuser in the sidebar.
 */
export function SlotDiffuserParameters({
  datasets,
  productId,
}: {
  datasets: CalcDataset[];
  productId: string;
}) {
  const { calc: calcMap, setCalc } = useCatalogParams();
  const calc = calcMap[productId] || {};
  const { performanceDatasets, availableGaps, availableSlots } = useSlotDiffuserOptions(datasets);

  const defaultGap = productId === "hcs" ? 25 : 19;
  const slotGap = calc.slotGap ?? (availableGaps.includes(defaultGap) ? defaultGap : availableGaps[0]);
  const slotsCount = calc.slotsCount ?? availableSlots[0] ?? 1;
  const cfm = calc.totalCfm ?? 0;

  const activeDataset = datasetForGap(performanceDatasets, slotGap);
  const cfmCol = activeDataset?.columns.find((c) => c.key === "cfm_per_ft" || c.unit === "CFM/ft");

  // Suggested the moment airflow is entered — no target length required to
  // see a first result. The user can then override it; onCommit persists
  // their choice, which the calculator clamps up to the nearest achievable
  // length (see rowForRequiredLength).
  const suggestedLength = useMemo(
    () => suggestRequiredLength(activeDataset, cfmCol, slotGap, slotsCount, cfm),
    [activeDataset, cfmCol, slotGap, slotsCount, cfm],
  );
  const requiredLength = calc.targetLength ?? suggestedLength ?? 0;

  return (
    <>
      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Slot Gap (mm)</span>
        <Select
          value={slotGap?.toString()}
          onValueChange={(v) => setCalc(productId, { slotGap: Number(v) })}
        >
          <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select gap" /></SelectTrigger>
          <SelectContent>
            {availableGaps.length > 0 ? (
              availableGaps.map((gap) => (
                <SelectItem key={gap} value={gap.toString()} className="text-xs">{gap} mm</SelectItem>
              ))
            ) : (
              <>
                <SelectItem value="19" className="text-xs">19 mm</SelectItem>
                <SelectItem value="25" className="text-xs">25 mm</SelectItem>
                <SelectItem value="38" className="text-xs">38 mm</SelectItem>
                <SelectItem value="51" className="text-xs">51 mm</SelectItem>
                <SelectItem value="63" className="text-xs">63 mm</SelectItem>
                <SelectItem value="76" className="text-xs">76 mm</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Number of Slots</span>
        <Select
          value={slotsCount?.toString()}
          onValueChange={(v) => setCalc(productId, { slotsCount: Number(v) })}
        >
          <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Select slots" /></SelectTrigger>
          <SelectContent>
            {availableSlots.length > 0 ? (
              availableSlots.map((sc) => (
                <SelectItem key={sc} value={sc.toString()} className="text-xs">{sc} Slot{sc > 1 ? "s" : ""}</SelectItem>
              ))
            ) : (
              [1, 2, 3, 4, 5, 6, 7, 8].map((sc) => (
                <SelectItem key={sc} value={sc.toString()} className="text-xs">{sc} Slot{sc > 1 ? "s" : ""}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Total Airflow (CFM)</span>
        <FreeNumberInput
          label="Total Airflow (CFM)"
          value={cfm || ""}
          onCommit={(v) => setCalc(productId, { totalCfm: v })}
        />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-normal text-muted-foreground">Required Length (ft)</span>
        <FreeNumberInput
          label="Required Length (ft)"
          value={requiredLength || ""}
          onCommit={(v) => setCalc(productId, { targetLength: v })}
        />
        {!calc.targetLength && suggestedLength != null && (
          <p className="text-[11px] text-muted-foreground">
            Suggested minimum for this airflow — enter your own length to override.
          </p>
        )}
      </div>
    </>
  );
}

import { TriangleAlert } from "lucide-react";

/** 
 * Renders the single row table in the main panel.
 */
export function SlotDiffuserCalculator({
  datasets,
  productId,
}: {
  datasets: CalcDataset[];
  productId: string;
}) {
  const { calc: calcMap } = useCatalogParams();
  const calc = calcMap[productId] || {};
  const { performanceDatasets, availableGaps, availableSlots } = useSlotDiffuserOptions(datasets);

  const defaultGap = productId === "hcs" ? 25 : 19;
  const slotGap = calc.slotGap ?? (availableGaps.includes(defaultGap) ? defaultGap : availableGaps[0]);
  const slotsCount = calc.slotsCount ?? availableSlots[0] ?? 1;
  const cfm = calc.totalCfm ?? 0;

  const activeDataset = datasetForGap(performanceDatasets, slotGap);

  if (!activeDataset) {
    return (
       <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
         No performance data tables found for this product yet.
       </div>
    );
  }

  const matchingRows = rowsForConfig(activeDataset, slotGap, slotsCount);
  const cfmCol = activeDataset.columns.find((c) => c.key === "cfm_per_ft" || c.unit === "CFM/ft");

  const rates = matchingRows.map((r) => num(r[cfmCol?.key ?? ""])).filter((v) => v > 0);
  const minCfmPerFt = rates.length > 0 ? Math.min(...rates) : 0;
  // Longest length this configuration can achieve — anything requested beyond
  // this can't be reached at any published rate.
  const longestAchievable = cfm > 0 && minCfmPerFt > 0 ? cfm / minCfmPerFt : undefined;

  const suggestedLength = suggestRequiredLength(activeDataset, cfmCol, slotGap, slotsCount, cfm);
  const requiredLength = calc.targetLength ?? suggestedLength ?? 0;

  // Only the user's own explicit choice can exceed what's achievable — the
  // suggestion is derived to always be the shortest (hence always reachable).
  const exceedsMax =
    calc.targetLength != null &&
    longestAchievable != null &&
    calc.targetLength > longestAchievable + 1e-6;

  const singleRow = rowForRequiredLength(matchingRows, cfmCol, cfm, requiredLength) ?? matchingRows[0];

  if (!singleRow) return null;

  let reqLength: string = "—";
  if (cfm > 0 && cfmCol) {
    const cfmPerFt = num(singleRow[cfmCol.key]);
    if (cfmPerFt > 0) reqLength = (cfm / cfmPerFt).toFixed(2);
  }

  const items = groupReadoutsByLabel([
    { label: "Required Length", value: reqLength, unit: "ft" },
    ...activeDataset.columns.map((c) => ({
      label: c.label,
      value: singleRow[c.key] == null ? "—" : String(singleRow[c.key]),
      unit: c.unit ?? undefined,
    })),
  ]);

  return (
    <div className="space-y-6">
      {exceedsMax && longestAchievable != null && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Requested length exceeds what this configuration can reach:</strong> the
            longest achievable length at this airflow is {longestAchievable.toFixed(2)} ft — showing that instead.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-primary">
          {activeDataset.label}
        </div>
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
    </div>
  );
}
