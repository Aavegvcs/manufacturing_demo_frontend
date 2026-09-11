"use client";

import {
  Calculator,
  FileText,
  Frame,
  Images,
  LayoutDashboard,
  type LucideIcon,
  Puzzle,
} from "lucide-react";
import type * as React from "react";

import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Typography,
} from "@/components/ui";

export interface ProductTabItem {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Optional count badge (e.g. number of accessories). */
  count?: number;
  /** Tab panel body. Falls back to a placeholder when omitted. */
  content?: React.ReactNode;
}

/** Default tab set mirroring the product detail screen. */
export const PRODUCT_TABS: ProductTabItem[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "calculation", label: "Calculation", icon: Calculator },
  { value: "dimensions", label: "Dimensions", icon: Frame },
  { value: "accessories", label: "Accessories", icon: Puzzle, count: 8 },
  { value: "gallery", label: "Gallery", icon: Images },
  { value: "documents", label: "Documents", icon: FileText },
];

interface ProductTabsProps {
  items?: ProductTabItem[];
  defaultValue?: string;
  /** Controlled active tab — pair with `onValueChange` to drive from the URL. */
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/**
 * Underlined product tab bar. Data-driven and reusable: pass `items` to control
 * the tabs and their panels; the icon + optional count badge render
 * automatically. Built on the shared `Tabs` primitive (underline variant).
 *
 * Uncontrolled by default (`defaultValue`); pass `value` + `onValueChange` to
 * keep the active tab in sync with external state (e.g. the URL).
 */
export function ProductTabs({
  items = PRODUCT_TABS,
  defaultValue,
  value,
  onValueChange,
  className,
}: ProductTabsProps) {
  const first = items[0]?.value;

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      defaultValue={value ? undefined : (defaultValue ?? first)}
      className={className}
    >
      <TabsList variant="underline">
        {items.map(({ value, label, icon: Icon, count }) => (
          <TabsTrigger key={value} value={value}>
            {Icon && <Icon />}
            <span>{label}</span>
            {typeof count === "number" && (
              <Badge variant="brand" className="ml-0.5">
                {count}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {items.map(({ value, label, content }) => (
        <TabsContent key={value} value={value}>
          {content ?? (
            <Typography variant="muted" className="py-6">
              {label} content goes here.
            </Typography>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
