import {
  type CalcColumn,
  type CalcDataset,
  signatureMatches,
} from "@/features/catalog";

export type Row = Record<string, number | string | null>;

export const AIRFLOW_UNIT = /m³\/h|m3\/h|l\/s|cfm/i;
export const PRESSURE_UNIT = /\bpa\b|in\.?\s*w/i;
export const THROW_KEY = /throw/i;
export const VELOCITY_UNIT = /\bfpm\b|\bm\/s\b/i;

export const num = (v: number | string | null): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
};

export const fmt = (v: number, decimals = 2): string => {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(Math.round(v * 10 ** decimals) / 10 ** decimals);
};

/**
 * A dataset is a "spectrum" (octave bands as ROWS) when its first column is an
 * explicit band/frequency axis. Deliberately strict — a generic text first
 * column (e.g. a model/size label) is NOT a spectrum; those are tables or
 * operating-point calculators.
 */
export function isSpectrum(ds: CalcDataset): boolean {
  const first = ds.columns[0];
  return (
    !!first &&
    (first.key === "band" || first.label.trim().toLowerCase() === "hz")
  );
}

/**
 * Parse an octave-band frequency from a column key/label, e.g. `hz_125` → 125,
 * `hz_1000` → 1000, `1k` → 1000, `4000 Hz` → 4000. Returns null when the column
 * is not a frequency band.
 */
export function bandHz(c: CalcColumn): number | null {
  const src = `${c.key} ${c.label}`.toLowerCase();
  const m = /(?:hz[_\s]*)?(\d+(?:\.\d+)?)\s*(k)?\s*(?:hz)?/.exec(
    c.key.toLowerCase().startsWith("hz") ? c.key.toLowerCase() : src,
  );
  // Require an explicit Hz/k cue so we don't treat arbitrary numeric columns as
  // frequency bands.
  if (!/hz|_?\dk\b|\bk\b/.test(src) && !/^hz_\d+$/.test(c.key)) return null;
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "k" ? n * 1000 : n;
}

/** Frequency-band columns of a dataset (octave-band sound power), low→high. */
export function freqColumns(
  ds: CalcDataset,
): { col: CalcColumn; hz: number }[] {
  return ds.columns
    .map((col) => ({ col, hz: bandHz(col) }))
    .filter((x): x is { col: CalcColumn; hz: number } => x.hz != null)
    .sort((a, b) => a.hz - b.hz);
}

/**
 * An "octave-band" dataset carries the frequency bands as COLUMNS (one row per
 * unit size), e.g. the AHRI radiated/discharge sound power tables. Rendered as a
 * frequency-response line chart rather than a calculator.
 */
export function isOctaveBands(ds: CalcDataset): boolean {
  return freqColumns(ds).length >= 3;
}

export function numericCols(ds: CalcDataset): CalcColumn[] {
  return ds.columns.filter((c) => c.type !== "text");
}

/** Linear interpolation of y at x over points sorted ascending by x. */
export function interp(points: { x: number; y: number }[], x: number): number {
  const pts = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (pts.length === 0) return Number.NaN;
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return pts[pts.length - 1].y;
}

export interface Analysis {
  airflow: CalcColumn;
  pressure: CalcColumn | null;
  throwCols: CalcColumn[];
  ncCol: CalcColumn | null;
  freeArea: CalcColumn | null;
  groupCol: CalcColumn | null;
  /** Numeric columns shown as interpolated readouts (excludes group + airflow). */
  readoutCols: CalcColumn[];
}

/**
 * Identify the roles of a dataset's columns so it can drive an operating-point
 * calculator (air flow → pressure / throw / NC). Returns null for datasets with
 * no air-flow column (pure reference tables like AK factor).
 */
export function analyze(ds: CalcDataset): Analysis | null {
  const nums = numericCols(ds);
  // An operating-point air flow is a single value, not a range — ignore
  // min_/max_ columns so a "capacity range" table (min_cfm + max_cfm) renders
  // as a reference table rather than a meaningless one-point calculator.
  const airflow = nums.find(
    (c) => AIRFLOW_UNIT.test(c.unit ?? "") && !/^(min|max)_/.test(c.key),
  );
  if (!airflow) return null;

  const n = ds.rows.length;
  const distinct = (c: CalcColumn) =>
    new Set(ds.rows.map((r) => String(r[c.key]))).size;

  // The grouping dimension is the product's size axis. Prefer a text size column
  // (e.g. "Listed Duct Size" on the 45° table); otherwise fall back to the
  // numeric column with the fewest distinct values (duct width).
  const textGroup = ds.columns.find((c) => c.type === "text");
  const numericGroup =
    nums
      .filter((c) => c.key !== airflow.key)
      .filter((c) => {
        const d = distinct(c);
        return d >= 2 && d <= 16 && d < n;
      })
      .sort((a, b) => distinct(a) - distinct(b))[0] ?? null;
  const groupCol = textGroup ?? numericGroup;

  const pressure =
    nums.find(
      (c) => PRESSURE_UNIT.test(c.unit ?? "") && c.key !== airflow.key,
    ) ?? null;
  const throwCols = nums.filter((c) => THROW_KEY.test(c.key));
  const ncCol = nums.find((c) => c.key === "nc") ?? null;
  const freeArea = nums.find((c) => /free_area/i.test(c.key)) ?? null;

  const excluded = new Set([airflow.key, groupCol?.key]);
  const readoutCols = nums.filter((c) => !excluded.has(c.key));

  return {
    airflow,
    pressure,
    throwCols,
    ncCol,
    freeArea,
    groupCol,
    readoutCols,
  };
}

/**
 * Preferred default throw column: the sidewall pattern at the lowest terminal
 * velocity (closest to a 0.2 m/s basis), falling back to any 50 fpm throw, then
 * the first throw column. Returns "" when the dataset has no throw columns.
 */
export function defaultThrowKey(a: Analysis): string {
  const c =
    a.throwCols.find(
      (col) => /sidewall/i.test(col.key) && /50fpm/i.test(col.key),
    ) ??
    a.throwCols.find((col) => /50fpm/i.test(col.key)) ??
    a.throwCols[0];
  return c?.key ?? "";
}

/**
 * The throw basis (sidewall / sill-floor) and terminal velocity are two separate
 * dimensions encoded into a single throw column key like
 * `throw_sidewall_150fpm_ft`. These helpers split that key so the parameter panel
 * can expose them as independent controls and the URL can store them compactly
 * (`tb`/`tv`) instead of the full column key.
 */
const THROW_BASIS_LABELS: Record<string, string> = {
  sidewall: "Sidewall",
  sill: "Sill / Floor",
};

export interface ThrowParts {
  basis: string;
  /** Terminal velocity in fpm, kept as a string for option/URL equality. */
  vel: string;
}

export function parseThrowKey(key: string): ThrowParts | null {
  // Accepts either separator: seeded data uses underscores
  // (throw_sidewall_150fpm), but the admin's column editor auto-generates
  // hyphenated keys from a label (slugify() → throw-sidewall-150fpm) — without
  // this, an admin-typed column can never be recognized as a throw column.
  const m = /throw[-_]([a-z]+)[-_](\d+)fpm/i.exec(key);
  return m ? { basis: m[1].toLowerCase(), vel: m[2] } : null;
}

/**
 * Resolve a throw column's basis + terminal velocity. Prefers the explicit
 * `mountingKey`/`terminalVelocity` fields set via the admin's Mounting /
 * Terminal velocity dropdowns (calculation-config-editor.tsx); falls back to
 * regex-parsing the column key for columns saved before that existed.
 */
export function throwPartsOf(c: CalcColumn): ThrowParts | null {
  if (c.mountingKey && c.terminalVelocity) {
    return { basis: c.mountingKey, vel: c.terminalVelocity };
  }
  return parseThrowKey(c.key);
}

export function throwBasisLabel(
  basis: string,
  labels?: Record<string, string>,
): string {
  return labels?.[basis] ?? THROW_BASIS_LABELS[basis] ?? basis;
}

/**
 * Distinct throw bases in column order, with display labels. `mountingLabels`
 * — from the product's CalculationConfig.mountingOptions — takes priority
 * over the built-in sidewall/sill labels, so an admin-defined Mounting value
 * (e.g. "Ceiling") shows its friendly label instead of the raw key.
 */
export function throwBases(
  a: Analysis,
  mountingLabels?: Record<string, string>,
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const c of a.throwCols) {
    const p = throwPartsOf(c);
    if (p && !seen.has(p.basis)) {
      seen.set(p.basis, throwBasisLabel(p.basis, mountingLabels));
    }
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}

/** Terminal velocities (fpm) available for a given basis, numeric-sorted. */
export function throwVels(a: Analysis, basis: string): string[] {
  const out: string[] = [];
  for (const c of a.throwCols) {
    const p = throwPartsOf(c);
    if (p && p.basis === basis && !out.includes(p.vel)) out.push(p.vel);
  }
  return out.sort((x, y) => Number(x) - Number(y));
}

/**
 * Resolve a basis + velocity pair back to a concrete throw column key. Falls back
 * to the same basis at any velocity, then to {@link defaultThrowKey}, so a stale
 * or partial selection still yields a usable column.
 */
export function resolveThrowKey(
  a: Analysis,
  basis?: string,
  vel?: string,
): string {
  if (basis && vel) {
    const exact = a.throwCols.find((c) => {
      const p = throwPartsOf(c);
      return p && p.basis === basis && p.vel === vel;
    });
    if (exact) return exact.key;
  }
  if (basis) {
    const sameBasis = a.throwCols.find(
      (c) => throwPartsOf(c)?.basis === basis,
    );
    if (sameBasis) return sameBasis.key;
  }
  return defaultThrowKey(a);
}

/** Distinct group values (sizes), numeric-sorted where possible. */
export function groupValues(ds: CalcDataset, a: Analysis): string[] {
  if (!a.groupCol) return [];
  const key = a.groupCol.key;
  return [...new Set(ds.rows.map((r) => String(r[key] ?? "")))]
    .filter((v) => v !== "")
    .sort((x, y) => Number(x) - Number(y));
}

/** Rows for the active group (all rows when there is no grouping column). */
export function rowsForGroup(
  ds: CalcDataset,
  a: Analysis,
  group: string,
): Row[] {
  if (!a.groupCol) return ds.rows;
  const key = a.groupCol.key;
  return ds.rows.filter((r) => String(r[key] ?? "") === group);
}

/** [min, max] air flow across the given rows. */
export function airflowExtent(rows: Row[], a: Analysis): [number, number] {
  const xs = rows
    .map((r) => num(r[a.airflow.key]))
    .filter(Number.isFinite)
    .sort((p, q) => p - q);
  return [xs[0] ?? 0, xs[xs.length - 1] ?? 1];
}

/** Parses a "300x300" / "300 x 300" duct-size token out of an arbitrary string. */
function parseSizeMm(src: string | null | undefined): { w: number; h: number } | null {
  if (!src) return null;
  const m = /(\d+)\s*x\s*(\d+)/i.exec(src);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]) };
}

export interface DamperVelocityAnalysis {
  velocityCol: CalcColumn;
  pressureCol: CalcColumn;
  /** Duct size for this dataset, parsed from its signature or label. */
  sizeMm: { w: number; h: number } | null;
}

/**
 * Identify a damper-style "velocity vs pressure drop" dataset: no air-flow
 * column, just a velocity (FPM/m/s) column and a pressure column, with duct
 * size as a separate dimension (one dataset per size) rather than a column.
 * Returns null when either axis column is missing.
 */
export function analyzeDamperVelocity(
  ds: CalcDataset,
): DamperVelocityAnalysis | null {
  const nums = numericCols(ds);
  const velocityCol = nums.find((c) => VELOCITY_UNIT.test(c.unit ?? ""));
  if (!velocityCol) return null;
  const pressureCol = nums.find(
    (c) => PRESSURE_UNIT.test(c.unit ?? "") && c.key !== velocityCol.key,
  );
  if (!pressureCol) return null;

  const sizeMm =
    parseSizeMm(ds.signature?.size) ?? parseSizeMm(ds.label);

  return { velocityCol, pressureCol, sizeMm };
}

/** Duct free area in ft², from width/height in millimetres. */
export function ductAreaFt2(widthMm: number, heightMm: number): number {
  const wFt = widthMm / 25.4 / 12;
  const hFt = heightMm / 25.4 / 12;
  return wFt * hFt;
}

/**
 * Pick the dataset that drives the operating-point calculator for the current
 * option selection: the first signature-matching, non-spectrum dataset that has
 * an air-flow column (so AK-factor-style reference tables are skipped).
 */
export function pickCalcDataset(
  datasets: CalcDataset[],
  selection: Record<string, string>,
): { dataset: CalcDataset; analysis: Analysis } | null {
  for (const ds of datasets) {
    if (!signatureMatches(ds.signature, selection)) continue;
    if (isSpectrum(ds) || isOctaveBands(ds)) continue;
    const analysis = analyze(ds);
    if (analysis) return { dataset: ds, analysis };
  }
  return null;
}
