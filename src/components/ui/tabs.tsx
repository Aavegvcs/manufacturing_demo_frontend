"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

type TabsVariant = "pill" | "underline";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

/**
 * `variant` styles both the list and its triggers. Triggers react to the
 * parent variant via the named `group/tabs-list`, so a single prop flips the
 * whole tab bar between a pill group and an underlined nav bar.
 */
function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: TabsVariant;
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "group/tabs-list inline-flex items-center text-muted-foreground",
        // pill
        "data-[variant=pill]:h-9 data-[variant=pill]:w-fit data-[variant=pill]:justify-center data-[variant=pill]:gap-1 data-[variant=pill]:rounded-lg data-[variant=pill]:bg-muted data-[variant=pill]:p-1",
        // underline
        "data-[variant=underline]:h-auto data-[variant=underline]:w-full data-[variant=underline]:justify-start data-[variant=underline]:gap-6 data-[variant=underline]:overflow-x-auto data-[variant=underline]:overflow-y-hidden data-[variant=underline]:scrollbar-none data-[variant=underline]:border-b data-[variant=underline]:border-border",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        // pill trigger
        "group-data-[variant=pill]/tabs-list:rounded-md group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:py-1 group-data-[variant=pill]/tabs-list:text-foreground/70 group-data-[variant=pill]/tabs-list:data-[state=active]:bg-background group-data-[variant=pill]/tabs-list:data-[state=active]:text-foreground group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-sm",
        // underline trigger
        "group-data-[variant=underline]/tabs-list:relative group-data-[variant=underline]/tabs-list:rounded-none group-data-[variant=underline]/tabs-list:border-b-[3px] group-data-[variant=underline]/tabs-list:border-transparent group-data-[variant=underline]/tabs-list:px-0.5 group-data-[variant=underline]/tabs-list:pb-3 group-data-[variant=underline]/tabs-list:pt-2 group-data-[variant=underline]/tabs-list:-mb-px group-data-[variant=underline]/tabs-list:hover:text-foreground group-data-[variant=underline]/tabs-list:data-[state=active]:border-brand group-data-[variant=underline]/tabs-list:data-[state=active]:font-semibold group-data-[variant=underline]/tabs-list:data-[state=active]:text-brand",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
