"use client";

import {
  filterByMatch,
  useCatalogParams,
  useProductSectionContent,
} from "@/features/catalog";

/** Shape of the `dimensions` section content served by the backend. */
interface FrameRow {
  id: string;
  flange_mm: number;
  overall_formula: string;
}
interface SizeRange {
  width_min_mm?: number;
  width_max_mm?: number;
  width_increment_mm?: number;
  length_min_mm?: number;
  length_max_mm?: number;
  length_increment_mm?: number;
}
interface CoreRow {
  label: string;
  deflection: string;
  bar_pitch_mm: number;
}
/** Generic dimension table (used by products without a grille frame model). */
interface DimColumn {
  key: string;
  label: string;
  unit?: string;
  type?: "number" | "text";
}
interface DimTable {
  title?: string;
  columns: DimColumn[];
  rows: Record<string, number | string | null>[];
}
/** A single parameter-scoped dimensional drawing. */
interface DimensionDrawing {
  url: string;
  alt?: string;
  /** Option values this drawing applies to; absent/empty = applies to all. */
  match?: Record<string, string>;
  sort_order?: number;
}
/** A single named blade-orientation/damper variant within a deflection group. */
interface DeflectionVariant {
  code: string;
  name: string;
  drawing_url?: string;
}
/**
 * Shared frame spec for one deflection family (single- or double-deflection
 * adjustable louvers), plus the named variants (orientation × damper) it covers.
 */
interface DeflectionSpec {
  variants: DeflectionVariant[];
  flange_mm?: number;
  blade_pitch_mm?: number;
  face_border_mm?: number;
  depth_with_damper_mm?: number;
  depth_without_damper_mm?: number;
  overall_size_formula?: string;
}
interface DimensionsContent {
  frames?: FrameRow[];
  frame_note?: string;
  size_range?: SizeRange;
  core_selection?: CoreRow[];
  /** Generic per-model dimension tables (VAV and other non-grille products). */
  tables?: DimTable[];
  /** Legacy single catalog dimensional drawing — read when `drawings` is absent/empty. */
  drawing?: string;
  /** Parameter-scoped drawing set (0-2 shown at once based on the current selection). */
  drawings?: DimensionDrawing[];
  /** Manufacturer's dimensional notes (a single blurb, or a list of them). */
  notes?: string | string[];
  tolerance_mm?: number;
  /** Adjustable-grille frame specs, keyed by blade configuration. */
  single_deflection?: DeflectionSpec;
  double_deflection?: DeflectionSpec;
}

/** Blade-orientation tokens used in variant codes (e.g. "AG-H", "AG-HV-D"). */
const ORIENTATION_TOKENS = new Set(["h", "v", "hv", "vh"]);

/**
 * Resolves the current option selection to a specific variant across the
 * single-/double-deflection groups, using the `<prefix>-<orientation>[-D]`
 * code convention: an orientation token (h/v/hv/vh) plus an optional trailing
 * "D" segment when a damper is selected. Selection values that are neither
 * "none" nor an orientation token are treated as "a damper is selected" (e.g.
 * "obd"). Returns null when nothing in the selection resolves to a variant —
 * callers fall back to showing the group's shared spec un-highlighted.
 */
function pickActiveVariant(
  groups: (DeflectionSpec | undefined)[],
  selection: Record<string, string>,
): { spec: DeflectionSpec; variant: DeflectionVariant } | null {
  const values = Object.values(selection).map((v) => v.toLowerCase());
  const orientation = values.find((v) => ORIENTATION_TOKENS.has(v));
  const wantsDamper = values.some((v) => v !== "none" && !ORIENTATION_TOKENS.has(v));

  for (const spec of groups) {
    if (!spec) continue;
    const variant = spec.variants.find((v) => {
      const tokens = v.code.split("-").slice(1).map((t) => t.toLowerCase());
      if (orientation && !tokens.includes(orientation)) return false;
      if (tokens.includes("d") !== wantsDamper) return false;
      return true;
    });
    if (variant) return { spec, variant };
  }
  return null;
}

/**
 * Dimensions tab — driven by the product's own `dimensions` section endpoint
 * (`/catalog/products/:id/dimensions`): a front-view schematic sized from the
 * published size range, frame/flange and core-selection tables, and the
 * manufacturer's dimensional notes.
 */
export function DimensionsPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductSectionContent(productId, "dimensions");
  const { selections, calc: calcMap } = useCatalogParams();
  const selection = selections[productId] ?? {};
  const calc = calcMap[productId];

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const content = (data?.content ?? null) as DimensionsContent | null;
  if (!content) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No dimensional data has been published for this product.
      </div>
    );
  }

  const drawings: DimensionDrawing[] =
    content.drawings && content.drawings.length > 0
      ? [...filterByMatch(content.drawings, selection)].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
      : content.drawing
        ? [{ url: content.drawing }]
        : [];

  // Adjustable-grille frame specs (single-/double-deflection): resolve the
  // exact orientation+damper variant from the current selection and show its
  // drawing plus the shared frame spec for that deflection family.
  if (content.single_deflection || content.double_deflection) {
    const active = pickActiveVariant(
      [content.single_deflection, content.double_deflection],
      selection,
    );
    const spec = active?.spec ?? content.single_deflection ?? content.double_deflection;
    const variant = active?.variant;
    // A matched variant pins the drawing to exactly its own image — the raw
    // `match` metadata alone can't tell "with damper" and "without damper"
    // apart (both share the same orientation key), so this is the one place
    // that's unambiguous.
    const activeDrawings = variant?.drawing_url
      ? (content.drawings ?? []).filter((d) => d.url === variant.drawing_url)
      : drawings;
    const hasDamper = variant?.code.toLowerCase().split("-").includes("d");
    const depth =
      hasDamper == null
        ? undefined
        : hasDamper
          ? spec?.depth_with_damper_mm
          : spec?.depth_without_damper_mm;
    const notes = Array.isArray(content.notes)
      ? content.notes
      : content.notes
        ? [content.notes]
        : [];

    return (
      <div className="space-y-6 pb-8">
        {activeDrawings.length > 0 && (
          <figure className="flex flex-col rounded-xl border bg-card p-6">
            <DrawingFigure
              drawings={activeDrawings}
              fallbackAlt="Dimensional drawing"
            />
            {variant && (
              <figcaption className="mt-4 text-center text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {variant.code}
                </span>{" "}
                — {variant.name}
              </figcaption>
            )}
          </figure>
        )}

        {spec && (
          <section className="space-y-3">
            <h3 className="text-label-bold text-muted-foreground">
              Frame &amp; blade dimensions
            </h3>
            <DataTable
              headers={["Spec", "Value"]}
              rows={
                [
                  spec.flange_mm != null && ["Flange", `${spec.flange_mm} mm`],
                  spec.blade_pitch_mm != null && [
                    "Blade pitch",
                    `${spec.blade_pitch_mm} mm`,
                  ],
                  spec.face_border_mm != null && [
                    "Face border",
                    `${spec.face_border_mm} mm`,
                  ],
                  depth != null && ["Depth", `${depth} mm`],
                  depth == null &&
                    spec.depth_without_damper_mm != null && [
                      "Depth (without damper)",
                      `${spec.depth_without_damper_mm} mm`,
                    ],
                  depth == null &&
                    spec.depth_with_damper_mm != null && [
                      "Depth (with damper)",
                      `${spec.depth_with_damper_mm} mm`,
                    ],
                  spec.overall_size_formula && [
                    "Overall size",
                    spec.overall_size_formula,
                  ],
                ].filter(Boolean) as string[][]
              }
            />
            {content.tolerance_mm != null && (
              <p className="text-xs text-muted-foreground">
                Tolerance: &plusmn;{content.tolerance_mm} mm.
              </p>
            )}
          </section>
        )}

        {notes.length > 0 && (
          <p className="text-xs text-muted-foreground">{notes.join(" ")}</p>
        )}
      </div>
    );
  }

  // Generic dimension tables (VAV and other non-grille products): render each
  // table with its own columns plus the manufacturer notes. No frame model.
  // `tables` entries are CMS-authored and can arrive malformed (e.g. a blank
  // placeholder row instead of a `{columns, rows}` object) — filter those out
  // rather than crashing on `.columns`/`.rows` of a non-object.
  const validTables = (content.tables ?? []).filter(
    (t): t is DimTable =>
      Boolean(t) && typeof t === "object" && Array.isArray((t as DimTable).columns),
  );
  if (validTables.length > 0) {
    return (
      <div className="space-y-6 pb-8">
        {drawings.length > 0 && (
          <figure className="flex flex-col rounded-xl border bg-card p-6">
            <DrawingFigure drawings={drawings} fallbackAlt="Dimensional drawing" />
          </figure>
        )}
        {validTables.map((t, i) => (
          <section key={t.title ?? `table-${i}`} className="space-y-3">
            {t.title && (
              <h3 className="text-label-bold text-muted-foreground">
                {t.title}
              </h3>
            )}
            <GenericDimTable table={t} />
          </section>
        ))}
      </div>
    );
  }

  const range = content.size_range ?? {};
  const enteredWidth = calc?.widthMm || 0;
  const enteredHeight = calc?.heightMm || 0;
  const hasEnteredSize = enteredWidth > 0 && enteredHeight > 0;
  const nomWidth = String(enteredWidth || range.length_max_mm || 300);
  const nomHeight = String(enteredHeight || range.width_max_mm || 200);
  const deflection = selection.deflection === "45" ? "45" : "0";
  const notes = Array.isArray(content.notes)
    ? content.notes
    : content.notes
      ? [content.notes]
      : [];

  return (
    <div className="space-y-6 pb-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Dimensional drawing — real catalog drawing(s) when published,
            otherwise a generated front-view schematic sized from the entered
            Width/Height, redrawn with straight (0°) or angled (45°) blades to
            match the Blade Deflection parameter. */}
        <figure className="flex flex-col rounded-xl border bg-card p-6">
          {drawings.length > 0 ? (
            <DrawingFigure
              drawings={drawings}
              fallbackAlt="Linear grille frame dimensional drawing"
            />
          ) : (
            <Schematic width={nomWidth} height={nomHeight} deflection={deflection} />
          )}
          <figcaption className="mt-4 text-center text-xs text-muted-foreground">
            {hasEnteredSize ? (
              <>
                Entered size{" "}
                <span className="font-semibold text-foreground">
                  {nomWidth} &times; {nomHeight} mm
                </span>{" "}
                at <span className="font-semibold text-foreground">{deflection}&deg;</span>{" "}
                blade deflection.
              </>
            ) : (
              <>
                Illustrative face at a nominal{" "}
                <span className="font-semibold text-foreground">
                  {nomWidth} &times; {nomHeight} mm
                </span>{" "}
                size — enter Width and Height in the Parameters panel for an exact preview.
              </>
            )}
          </figcaption>
        </figure>
      </div>

      {/* Manufacturer's dimensional notes — real admin-authored notes take
          over from the generic boilerplate line above once they exist. */}
      {notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {notes.map((n, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static notes list, no stable id
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {/* Frame / flange options */}
      {content.frames && content.frames.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-label-bold text-muted-foreground">
            Frame options
          </h3>
          <DataTable
            headers={["Frame", "Flange (mm)", "Overall size"]}
            rows={content.frames.map((f) => [
              f.id,
              String(f.flange_mm),
              f.overall_formula,
            ])}
          />
          {content.frame_note && (
            <p className="text-xs text-muted-foreground">
              {content.frame_note}
            </p>
          )}
        </section>
      )}

      {/* Core / deflection selection */}
      {content.core_selection && content.core_selection.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-label-bold text-muted-foreground">
            Core selection
          </h3>
          <DataTable
            headers={["Core", "Deflection (°)", "Bar pitch (mm)"]}
            rows={content.core_selection.map((c) => [
              c.label,
              c.deflection,
              String(c.bar_pitch_mm),
            ])}
          />
        </section>
      )}
    </div>
  );
}

/**
 * Renders 0/1/2 dimensional drawings — full-width for one, side-by-side for
 * two (parameter-scoped pairs, e.g. plain vs with-damper). Categories that
 * only ever publish the legacy single `drawing` string resolve to exactly one
 * item here, so this renders pixel-identical to the old single-<img> markup.
 */
function DrawingFigure({
  drawings,
  fallbackAlt,
}: {
  drawings: DimensionDrawing[];
  fallbackAlt: string;
}) {
  if (drawings.length === 0) return null;
  return (
    <div className={drawings.length > 1 ? "grid gap-4 sm:grid-cols-2" : ""}>
      {drawings.map((d) => (
        // biome-ignore lint/performance/noImgElement: intrinsic aspect ratio, no fixed container
        <img
          key={d.url}
          src={d.url}
          alt={d.alt ?? fallbackAlt}
          loading="lazy"
          // w-full keeps a definite, non-zero width before the image has
          // loaded (required for `loading="lazy"` to ever fire — an
          // auto-sized <img> with unknown intrinsic dimensions collapses to
          // a 0x0 box, which some browsers never treat as "near viewport").
          // max-height + object-contain then caps portrait-oriented
          // catalogue drawings (e.g. a cross-section-only diagram with no
          // companion front view) from stretching to an absurd rendered
          // height — landscape drawings are unaffected since their
          // width-constrained height already stays under the cap.
          className="mx-auto h-auto max-h-[560px] w-full object-contain"
        />
      ))}
    </div>
  );
}

/** Renders a generic dimension table from its own column metadata + rows. */
function GenericDimTable({ table }: { table: DimTable }) {
  const columns = table.columns;
  const rows = Array.isArray(table.rows) ? table.rows : [];
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  className={
                    i === 0
                      ? "whitespace-nowrap px-4 py-2.5 text-left font-semibold text-foreground"
                      : "whitespace-nowrap border-l px-4 py-2.5 text-left font-semibold text-foreground"
                  }
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
            {rows.map((r, ri) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: positional data rows
                key={ri}
                className="border-b last:border-0 odd:bg-muted/20"
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={
                      i === 0
                        ? "whitespace-nowrap px-4 py-2.5 text-left font-medium text-foreground"
                        : "whitespace-nowrap border-l px-4 py-2.5 text-left tabular-nums text-muted-foreground"
                    }
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

/** Compact bordered table; first column left-aligned, the rest right-aligned. */
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {headers.map((h, i) => (
              <th
                key={h}
                className={
                  i === 0
                    ? "px-4 py-2.5 text-left font-semibold text-foreground"
                    : "border-l px-4 py-2.5 text-left font-semibold text-foreground"
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells) => (
            <tr
              key={cells.join("|")}
              className="border-b last:border-0 odd:bg-muted/20"
            >
              {cells.map((cell, i) => (
                <td
                  key={`${cells.join("|")}-${i}`}
                  className={
                    i === 0
                      ? "px-4 py-2.5 text-left font-medium text-foreground"
                      : "border-l px-4 py-2.5 text-left tabular-nums text-muted-foreground"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Theme-aware front-view drawing, scaled to the real Width×Height aspect
 * ratio (a 750×100 grille reads as a long flat bar, a 300×300 as a square —
 * the box shape itself carries the proportions, not just the text labels).
 *
 * Depicts the actual double-deflection construction: a fixed REAR blade set
 * (vertical, perpendicular) beneath the adjustable FRONT blade set (straight
 * at 0°, angled at 45° per the Blade Deflection parameter), matching how the
 * real AAG grille is built — two blade rows at 90° to each other.
 */
function Schematic({
  width,
  height,
  deflection = "0",
}: {
  width: string;
  height: string;
  deflection?: string;
}) {
  const isAngled = deflection === "45";
  const widthNum = Math.max(Number(width) || 300, 1);
  const heightNum = Math.max(Number(height) || 200, 1);

  // Fit the true W:H ratio into a bounded drawing area, centered, so the
  // drawn box's proportions change with the entered size.
  const MAX_W = 250;
  const MAX_H = 170;
  const CENTER_X = 168;
  const CENTER_Y = 165;
  const scale = Math.min(MAX_W / widthNum, MAX_H / heightNum);
  const outerW = widthNum * scale;
  const outerH = heightNum * scale;
  const outerX = CENTER_X - outerW / 2;
  const outerY = CENTER_Y - outerH / 2;
  const flange = Math.min(7, outerW / 7, outerH / 7);
  const innerX = outerX + flange;
  const innerY = outerY + flange;
  const innerW = Math.max(outerW - flange * 2, 1);
  const innerH = Math.max(outerH - flange * 2, 1);
  const clipId = "aagSchematicInner";

  // Dimension callouts sit a fixed gap off the box's own edges (not fixed
  // canvas coordinates) so they track the box instead of floating far away
  // from it at extreme aspect ratios.
  const DIM_GAP = 12;
  const DIM_TEXT_GAP = 9;
  const TICK = 4;
  const widthLineY = outerY - DIM_GAP;
  const heightLineX = outerX + outerW + DIM_GAP;

  // Rear blades: fixed, perpendicular to the front set, spaced at a
  // realistic ~25mm pitch (scaled) — unaffected by Blade Deflection.
  const rearPitch = Math.min(30, Math.max(7, 25 * scale));
  const rearCount = Math.max(3, Math.floor(innerW / rearPitch));

  // Front blades: the adjustable set, spaced at a realistic ~22mm pitch.
  const frontPitch = Math.min(26, Math.max(7, 22 * scale));
  const frontCount = Math.max(3, Math.floor(innerH / frontPitch));

  // Angled (45°) blades are generated as a family of parallel lines at a
  // fixed pixel pitch along the diagonal, spanning well past the inner
  // rect's width AND height on both ends — clipped to the rect afterward —
  // so the hatch fully tiles regardless of aspect ratio (a 750×100 "long bar"
  // needs many more lines across its width than a 300×300 square does).
  const diagStep = frontPitch * Math.SQRT2;
  const diagCount = Math.max(4, Math.ceil((innerW + innerH) / diagStep) + 2);
  const diagonalLines = Array.from({ length: diagCount }, (_, i) => {
    const x0 = innerX - innerH + i * diagStep;
    return { x1: x0, y1: innerY + innerH, x2: x0 + innerH, y2: innerY };
  });

  return (
    <svg
      viewBox="0 0 400 300"
      className="h-auto w-full"
      role="img"
      aria-label={`Front view, ${width} by ${height} millimetres, front blades at ${deflection} degrees`}
    >
      <title>Front-view schematic — double deflection blade layout</title>
      <defs>
        <clipPath id={clipId}>
          <rect x={innerX} y={innerY} width={innerW} height={innerH} />
        </clipPath>
        <marker id="aagDimArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0.7 L5,3 L0,5.3 Z" fill="var(--primary)" />
        </marker>
        <linearGradient id="aagSchemFrame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4657" />
          <stop offset="1" stopColor="#232c38" />
        </linearGradient>
      </defs>

      {/* Outer frame profile (extruded aluminium border) */}
      <rect
        x={outerX}
        y={outerY}
        width={outerW}
        height={outerH}
        rx="3"
        fill="url(#aagSchemFrame)"
      />
      {/* Inner face */}
      <rect x={innerX} y={innerY} width={innerW} height={innerH} fill="#101722" />

      {/* Rear blade set — fixed, perpendicular to the front set */}
      <g
        clipPath={`url(#${clipId})`}
        stroke="#4a5b73"
        strokeWidth={Math.min(2, Math.max(1, flange * 0.22))}
        strokeLinecap="round"
      >
        {Array.from({ length: rearCount }, (_, i) => {
          const x = innerX + ((i + 0.5) / rearCount) * innerW;
          return <line key={i} x1={x} y1={innerY - 4} x2={x} y2={innerY + innerH + 4} />;
        })}
      </g>

      {/* Front blade set — adjustable: straight at 0°, angled at 45° */}
      <g
        clipPath={`url(#${clipId})`}
        stroke="#c7d2e0"
        strokeWidth={Math.min(2.6, Math.max(1.3, flange * 0.3))}
        strokeLinecap="round"
      >
        {isAngled
          ? diagonalLines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)
          : Array.from({ length: frontCount }, (_, i) => {
              const y = innerY + ((i + 0.5) / frontCount) * innerH;
              return <line key={i} x1={innerX} y1={y} x2={innerX + innerW} y2={y} />;
            })}
      </g>

      {/* Corner mounting screws */}
      {[
        [outerX + flange * 0.9, outerY + flange * 0.9],
        [outerX + outerW - flange * 0.9, outerY + flange * 0.9],
        [outerX + flange * 0.9, outerY + outerH - flange * 0.9],
        [outerX + outerW - flange * 0.9, outerY + outerH - flange * 0.9],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="#0b0f16" />
      ))}

      {/* Width callout (top) — a fixed gap above the box's own top edge, so
          it tracks the box instead of sitting at a fixed canvas position. */}
      <line
        x1={outerX}
        x2={outerX + outerW}
        y1={widthLineY}
        y2={widthLineY}
        stroke="var(--secondary)"
        strokeWidth="1"
        markerStart="url(#aagDimArrow)"
        markerEnd="url(#aagDimArrow)"
      />
      <line
        x1={outerX}
        x2={outerX}
        y1={widthLineY - TICK}
        y2={widthLineY + TICK}
        stroke="var(--secondary)"
        strokeWidth="1"
      />
      <line
        x1={outerX + outerW}
        x2={outerX + outerW}
        y1={widthLineY - TICK}
        y2={widthLineY + TICK}
        stroke="var(--secondary)"
        strokeWidth="1"
      />
      <text
        x={outerX + outerW / 2}
        y={widthLineY - DIM_TEXT_GAP}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--primary)"
      >
        {width} mm
      </text>

      {/* Height callout (right) — a fixed gap right of the box's own right
          edge, so it tracks the box instead of a fixed canvas position. */}
      <line
        x1={heightLineX}
        x2={heightLineX}
        y1={outerY}
        y2={outerY + outerH}
        stroke="var(--secondary)"
        strokeWidth="1"
        markerStart="url(#aagDimArrow)"
        markerEnd="url(#aagDimArrow)"
      />
      <line
        x1={heightLineX - TICK}
        x2={heightLineX + TICK}
        y1={outerY}
        y2={outerY}
        stroke="var(--secondary)"
        strokeWidth="1"
      />
      <line
        x1={heightLineX - TICK}
        x2={heightLineX + TICK}
        y1={outerY + outerH}
        y2={outerY + outerH}
        stroke="var(--secondary)"
        strokeWidth="1"
      />
      <text
        x={heightLineX + DIM_TEXT_GAP}
        y={outerY + outerH / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--primary)"
        transform={`rotate(90 ${heightLineX + DIM_TEXT_GAP} ${outerY + outerH / 2})`}
      >
        {height} mm
      </text>

      {/* Legend — the two blade sets are the defining feature of a double
          deflection grille, so callers see what each layer represents. */}
      <g transform="translate(16, 268)">
        <line x1="0" y1="0" x2="16" y2="0" stroke="#c7d2e0" strokeWidth="2" strokeLinecap="round" />
        <text x="21" y="2.8" fontSize="9" fill="var(--muted-foreground)">
          Front blades — adjustable, {deflection}&deg;
        </text>
      </g>
      <g transform="translate(16, 283)">
        <line x1="0" y1="0" x2="16" y2="0" stroke="#4a5b73" strokeWidth="2" strokeLinecap="round" />
        <text x="21" y="2.8" fontSize="9" fill="var(--muted-foreground)">
          Rear blades — fixed, perpendicular
        </text>
      </g>
    </svg>
  );
}
