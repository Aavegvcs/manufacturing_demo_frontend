"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { ConfigGroup, ProductConfig } from "@/features/catalog";
import { cn } from "@/lib/utils";

interface ProductConfiguratorProps {
  config: ProductConfig;
  /** Current selection (source of truth lives in the URL, owned by the panel). */
  values: Record<string, string>;
  /** Notified whenever a parameter changes, with the full selection map. */
  onChange?: (values: Record<string, string>) => void;
}

/**
 * Renders a product's configuration schema as collapsible groups of labelled
 * dropdowns. Fully data-driven — add parameters/groups in the API (or mock) and
 * they appear here with no code change. The visible parameter set is whatever
 * the (section-scoped) `config` carries, so the panel can pass a different
 * schema per active tab and this component just renders it.
 *
 * Controlled: `values` come from the panel (URL-backed) so a selection made on
 * one tab is preserved when the parameter set changes on another.
 */
export function ProductConfigurator({
  config,
  values,
  onChange,
}: ProductConfiguratorProps) {
  const handleChange = (id: string, value: string) => {
    onChange?.({ ...values, [id]: value });
  };

  if (config.groups.length === 0) {
    return (
      <p className="py-4 text-xs text-muted-foreground">
        No parameters for this section.
      </p>
    );
  }

  return (
    <ConfigGroupList config={config} values={values} onChange={handleChange} />
  );
}

/**
 * Accordion of config groups: at most one group is open at a time, so opening
 * one collapses whichever other group was open. Defaults to the first group
 * that opts in via `defaultOpen` (or the first group overall).
 */
function ConfigGroupList({
  config,
  values,
  onChange,
}: {
  config: ProductConfig;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  const [openId, setOpenId] = useState<string | undefined>(
    () => config.groups.find((g) => g.defaultOpen)?.id ?? config.groups[0]?.id,
  );

  return (
    <div className="flex flex-col divide-y">
      {config.groups.map((group) => (
        <ConfigGroupSection
          key={group.id}
          group={group}
          values={values}
          onChange={onChange}
          open={openId === group.id}
          onToggle={() =>
            setOpenId((current) => (current === group.id ? undefined : group.id))
          }
        />
      ))}
    </div>
  );
}

function ConfigGroupSection({
  group,
  values,
  onChange,
  open,
  onToggle,
}: {
  group: ConfigGroup;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="py-4 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
      >
        <span>{group.title}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3.5">
          {group.parameters.map((param) => (
            <div
              key={param.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3"
            >
              <Label
                htmlFor={param.id}
                className="text-xs font-normal text-muted-foreground"
              >
                {param.label}
              </Label>
              <Select
                value={values[param.id]}
                onValueChange={(value) => onChange(param.id, value)}
              >
                <SelectTrigger id={param.id} className="h-8 w-full text-xs">
                  <SelectValue placeholder={param.placeholder ?? "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {param.options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-xs"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
