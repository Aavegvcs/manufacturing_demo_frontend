"use client";

import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  CartesianGrid,
  type InverseScaleFunction,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  useXAxisInverseScale,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartSeries {
  /** Legend label for this line. */
  name: string;
  /** Stroke colour. */
  color: string;
  /** Points for this line; each line carries its own X range. */
  points: { x: number; y: number }[];
}

export interface OperatingDot {
  x: number;
  y: number;
  color: string;
}

interface PerformanceChartProps {
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  /** Legend heading (e.g. the grouping dimension) shown above a multi-line legend. */
  groupLabel?: string;
  /** Vertical reference line at this X (the selected operating air flow). */
  operatingX?: number;
  /** Horizontal reference line at this Y (single-curve readout). */
  operatingY?: number;
  /** Marked points on each curve at the operating air flow. */
  operatingDots?: OperatingDot[];
  height?: number;
  logX?: boolean;
  logY?: boolean;
  /**
   * When true the plot becomes editable: clicking or dragging anywhere on the
   * chart moves the operating point along the X axis and reports the new value
   * via {@link onOperatingXChange}. The reported value is the interpolated X at
   * the cursor, clamped to [{@link xDomainMin}, {@link xDomainMax}].
   */
  editable?: boolean;
  onOperatingXChange?: (x: number) => void;
  /** Lower/upper bound used to clamp the dragged operating X. */
  xDomainMin?: number;
  xDomainMax?: number;
}

const axisCaption = (label: string, unit?: string) =>
  unit ? `${label} (${unit})` : label;

/** Compact numeric tick: integers as-is, fractions to 2-3 sig figs. */
const fmtTick = (v: number) => {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 1) return String(Math.round(v * 10) / 10);
  return String(Math.round(v * 1000) / 1000);
};

/**
 * Multi-series engineering line chart (Recharts). Each series carries its own
 * data array, so curves with different X ranges share a single auto-scaled
 * numeric axis. Supports an operating-point crosshair (vertical/horizontal
 * reference lines + marked dots) so it reads like a manufacturer selection
 * chart. The legend sits to the right so it never collides with the X title.
 */
export function PerformanceChart({
  series,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  groupLabel,
  operatingX,
  operatingY,
  operatingDots,
  height = 320,
  logX = false,
  logY = false,
  editable = false,
  onOperatingXChange,
  xDomainMin,
  xDomainMax,
}: PerformanceChartProps) {
  const multi = series.length > 1;
  const interactive = editable && !!onOperatingXChange;

  // Drag-to-edit plumbing. The X scale lives inside the chart context, so a
  // tiny child captures its inverse (pixel → data value) into a ref the pointer
  // handlers on the wrapper can read. Pointer events (not mouse) cover touch.
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<InverseScaleFunction | undefined>(undefined);
  const draggingRef = useRef(false);

  const commitFromClientX = useCallback(
    (clientX: number) => {
      const invert = scaleRef.current;
      const svg = wrapRef.current?.querySelector("svg");
      if (!invert || !svg || !onOperatingXChange) return;
      const rect = svg.getBoundingClientRect();
      const raw = Number(invert(clientX - rect.left));
      if (!Number.isFinite(raw)) return;
      const lo = xDomainMin ?? Number.NEGATIVE_INFINITY;
      const hi = xDomainMax ?? Number.POSITIVE_INFINITY;
      onOperatingXChange(Math.min(hi, Math.max(lo, raw)));
    },
    [onOperatingXChange, xDomainMin, xDomainMax],
  );

  const dragProps = interactive
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          draggingRef.current = true;
          wrapRef.current?.setPointerCapture(e.pointerId);
          commitFromClientX(e.clientX);
          e.preventDefault();
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          if (draggingRef.current) commitFromClientX(e.clientX);
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
          draggingRef.current = false;
          wrapRef.current?.releasePointerCapture(e.pointerId);
        },
        onPointerCancel: () => {
          draggingRef.current = false;
        },
      }
    : {};

  return (
    <div
      ref={wrapRef}
      className="w-full text-muted-foreground"
      style={
        interactive ? { cursor: "ew-resize", touchAction: "none" } : undefined
      }
      {...dragProps}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart margin={{ top: 20, right: 20, bottom: 40, left: 24 }}>
          {interactive && <ScaleReader scaleRef={scaleRef} />}
          <CartesianGrid stroke="currentColor" strokeOpacity={0.18} vertical />
          <XAxis
            type="number"
            dataKey="x"
            scale={logX ? "log" : "linear"}
            domain={logX ? ["auto", "auto"] : ["dataMin", "dataMax"]}
            allowDuplicatedCategory={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            tickMargin={6}
            stroke="currentColor"
            strokeOpacity={0.35}
            tickFormatter={fmtTick}
          >
            <Label
              value={axisCaption(xLabel, xUnit)}
              position="insideBottom"
              offset={-24}
              style={{
                fontSize: 12,
                fontWeight: 600,
                fill: "currentColor",
                textAnchor: "middle",
              }}
            />
          </XAxis>
          <YAxis
            scale={logY ? "log" : "linear"}
            domain={logY ? ["auto", "auto"] : [0, "auto"]}
            tick={{ fontSize: 11, fill: "currentColor" }}
            tickMargin={4}
            width={68}
            stroke="currentColor"
            strokeOpacity={0.35}
            tickFormatter={fmtTick}
          >
            <Label
              value={axisCaption(yLabel, yUnit)}
              angle={-90}
              position="insideLeft"
              offset={2}
              dx={-4}
              style={{
                fontSize: 12,
                fontWeight: 600,
                fill: "currentColor",
                textAnchor: "middle",
              }}
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgba(100,116,139,0.25)",
            }}
            labelFormatter={(v) =>
              `${xLabel}: ${fmtTick(Number(v))} ${xUnit ?? ""}`
            }
            formatter={(value, name) => [
              `${fmtTick(Number(value))} ${yUnit ?? ""}`,
              name,
            ]}
          />
          {multi && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="plainline"
              width={92}
              wrapperStyle={{
                fontSize: 11,
                lineHeight: "18px",
                paddingLeft: 8,
              }}
              {...(groupLabel
                ? {
                    content: (props) => (
                      <LegendWithTitle {...props} title={groupLabel} />
                    ),
                  }
                : {})}
            />
          )}

          {operatingY != null && (
            <ReferenceLine
              y={operatingY}
              stroke="var(--primary)"
              strokeOpacity={0.6}
              strokeDasharray="4 3"
            >
              <Label
                content={(p) => (
                  <AxisValueChip
                    viewBox={p.viewBox as ChipViewBox}
                    value={fmtTick(operatingY)}
                    axis="y"
                  />
                )}
              />
            </ReferenceLine>
          )}
          {operatingX != null && (
            <ReferenceLine
              x={operatingX}
              stroke="var(--primary)"
              strokeOpacity={0.6}
              strokeDasharray="4 3"
            >
              <Label
                content={(p) => (
                  <AxisValueChip
                    viewBox={p.viewBox as ChipViewBox}
                    value={fmtTick(operatingX)}
                    axis="x"
                  />
                )}
              />
            </ReferenceLine>
          )}
          {(operatingDots ?? []).map((d) => (
            <ReferenceDot
              key={`${d.x}-${d.y}-${d.color}`}
              x={d.x}
              y={d.y}
              r={interactive ? 6 : 4}
              fill={d.color}
              stroke="#fff"
              strokeWidth={interactive ? 2.5 : 1.5}
              // Let pointer events fall through to the wrapper so the dot itself
              // is draggable rather than swallowing the drag.
              style={interactive ? { pointerEvents: "none" } : undefined}
            />
          ))}

          {series.map((s) => (
            <Line
              key={s.name}
              data={s.points}
              type="monotone"
              dataKey="y"
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 1.6, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {interactive && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground/80">
          Drag on the chart to set the operating {xLabel.toLowerCase()}.
        </p>
      )}
    </div>
  );
}

type ChipViewBox = { x?: number; y?: number; width?: number; height?: number };

/**
 * Highlighted operating-value chip drawn on an axis where a reference line meets
 * it: the X value sits under the bottom axis, the Y value in the left gutter —
 * mirroring a manufacturer selection chart that calls out the chosen point on
 * both scales. Rendered as a custom Recharts `Label` content so it can paint a
 * filled background behind the value.
 */
function AxisValueChip({
  viewBox,
  value,
  axis,
}: {
  viewBox?: ChipViewBox;
  value: string;
  axis: "x" | "y";
}) {
  if (!viewBox) return null;
  const { x = 0, y = 0, width = 0, height = 0 } = viewBox;
  const w = Math.max(24, value.length * 7 + 12);
  const h = 16;
  // X chip: centred on the vertical line, just below the plot (over the ticks).
  // Y chip: centred on the horizontal line, in the left axis gutter.
  const cx = axis === "x" ? x : x - w / 2 - 3;
  const cy = axis === "x" ? y + height + 10 : y;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={3}
        fill="var(--primary)"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill="var(--primary-foreground)"
      >
        {value}
      </text>
    </g>
  );
}

/**
 * Renders nothing — its only job is to read the X axis' inverse scale (a
 * pixel → data-value function that only exists inside the chart context) and
 * stash it in a ref so the wrapper's pointer handlers can map a cursor position
 * back to an air-flow value while dragging.
 */
function ScaleReader({
  scaleRef,
}: {
  scaleRef: RefObject<InverseScaleFunction | undefined>;
}) {
  const invert = useXAxisInverseScale();
  useEffect(() => {
    scaleRef.current = invert;
  }, [invert, scaleRef]);
  return null;
}

/** Right-side legend with a small heading (the grouping dimension). */
function LegendWithTitle({
  payload,
  title,
}: {
  payload?: readonly { value?: unknown; color?: string }[];
  title: string;
}) {
  return (
    <div className="text-[11px] leading-[18px]">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <ul className="space-y-0.5">
        {(payload ?? []).map((entry) => {
          const label = String(entry.value ?? "");
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-3.5 shrink-0 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
