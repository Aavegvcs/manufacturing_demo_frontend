"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

/**
 * Shared "Parameter / Value / Unit" readout table — every operating-point
 * calculator (charts, slot diffuser, jet nozzle) shows its result this way:
 * one row per parameter rather than one wide row per dataset column, since a
 * single result row with many columns forces horizontal scrolling.
 */

export interface ReadoutVariant {
  value: string;
  unit?: string;
}

export function ReadoutTableHead() {
  return (
    <thead>
      <tr className="border-b bg-primary text-left text-primary-foreground">
        <th className="px-4 py-2.5 font-semibold">Parameter</th>
        <th className="border-l border-primary-foreground/20 px-4 py-2.5 font-semibold">
          Value
        </th>
        <th className="w-20 border-l border-primary-foreground/20 px-4 py-2.5 font-semibold">
          Unit
        </th>
      </tr>
    </thead>
  );
}

/**
 * One readout row. Pass `value`/`unit` for a plain fixed-unit readout, or
 * `variants` when the same parameter is published in more than one unit (e.g.
 * airflow in L/s, m³/hr and CFM) — the Unit column then becomes a dropdown
 * that swaps which variant's value is shown, instead of listing one row per
 * unit. A single-item `variants` array (or none at all) renders exactly like
 * a plain row, so callers don't need to branch.
 */
export function ReadoutRow({
  label,
  value,
  unit,
  variants,
}: {
  label: string;
  value?: string;
  unit?: string;
  variants?: ReadoutVariant[];
}) {
  const [selected, setSelected] = useState(0);

  if (variants && variants.length > 1) {
    const active = variants[selected] ?? variants[0];
    return (
      <tr className="border-b last:border-0 odd:bg-muted/20">
        <td className="px-4 py-2.5 text-foreground">{label}</td>
        <td className="border-l px-4 py-2.5 font-medium tabular-nums text-foreground">
          {active.value}
        </td>
        <td className="border-l px-1.5 py-1.5 text-muted-foreground">
          <Select
            value={String(selected)}
            onValueChange={(v) => setSelected(Number(v))}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-full min-w-0 border-none bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variants.map((v, i) => (
                <SelectItem key={`${v.unit}-${i}`} value={String(i)} className="text-xs">
                  {v.unit || "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      </tr>
    );
  }

  const single = variants?.[0];
  return (
    <tr className="border-b last:border-0 odd:bg-muted/20">
      <td className="px-4 py-2.5 text-foreground">{label}</td>
      <td className="border-l px-4 py-2.5 font-medium tabular-nums text-foreground">
        {single?.value ?? value}
      </td>
      <td className="border-l px-4 py-2.5 text-muted-foreground">
        {single?.unit ?? unit ?? ""}
      </td>
    </tr>
  );
}

/** Standalone table (with its own bordered wrapper) for a flat list of readouts. */
export function ReadoutTable({
  items,
}: {
  items: { label: string; value: string; unit?: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <ReadoutTableHead />
        <tbody>
          {items.map((item, i) => (
            <ReadoutRow
              key={`${item.label}-${i}`}
              label={item.label}
              value={item.value}
              unit={item.unit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface FlatReadout {
  label: string;
  value: string;
  unit?: string;
}

export interface GroupedReadout {
  label: string;
  value?: string;
  unit?: string;
  variants?: ReadoutVariant[];
}

/**
 * Collapses a flat, already-formatted readout list so that entries sharing a
 * label (the same parameter published in more than one unit — e.g. a
 * dataset with separate CFM and L/s columns for "Air Flow") become one entry
 * with `variants`, which `ReadoutRow` renders as a unit-switch dropdown. A
 * label that appears only once passes through as a plain entry. This is the
 * one place "does this field have more than one unit available" is decided,
 * so every calculator gets the dropdown automatically wherever the
 * underlying data actually has alternate units — no per-calculator branching.
 */
export function groupReadoutsByLabel(entries: FlatReadout[]): GroupedReadout[] {
  const order: string[] = [];
  const byLabel = new Map<string, FlatReadout[]>();
  for (const e of entries) {
    if (!byLabel.has(e.label)) {
      byLabel.set(e.label, []);
      order.push(e.label);
    }
    byLabel.get(e.label)?.push(e);
  }
  return order.map((label) => {
    const es = byLabel.get(label) ?? [];
    if (es.length > 1) {
      return { label, variants: es.map((e) => ({ value: e.value, unit: e.unit })) };
    }
    return { label, value: es[0]?.value, unit: es[0]?.unit };
  });
}
