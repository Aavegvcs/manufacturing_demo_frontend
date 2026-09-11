"use client";

import { Puzzle } from "lucide-react";
import Image from "next/image";

import { useProductSectionContent } from "@/features/catalog";

import { RenderNestedValue, humanize } from "./render-nested-value";

/** One accessory as served by the backend `accessories` section content. */
export interface AccessoryItem {
  name: string;
  model?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
}
interface AccessoriesContent {
  items?: AccessoryItem[];
}

/** Fields rendered as the card title/subtitle/body/image — excluded from detail rows. */
const PRIMARY_FIELDS = new Set(["name", "model", "description", "image"]);

/**
 * Accessories tab — cards for every accessory the product publishes via its own
 * `accessories` endpoint (`/catalog/products/:id/accessories`). Each card shows
 * the accessory name, model, description and its remaining spec fields.
 */
export function AccessoriesPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductSectionContent(
    productId,
    "accessories",
  );

  if (isLoading) return <AccessoriesSkeleton />;

  const content = (data?.content ?? null) as AccessoriesContent | null;
  const items = content?.items ?? [];

  return (
    <div className="space-y-6 pb-8">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          No accessories are available for this product.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <AccessoryCard key={item.name} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AccessoryCard({ item }: { item: AccessoryItem }) {
  const details = Object.entries(item).filter(
    ([k, v]) => !PRIMARY_FIELDS.has(k) && v != null,
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        {item.image ? (
          <div className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="80px"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-container text-primary">
            <Puzzle className="size-5" strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-foreground">
            {item.name}
          </h3>
        </div>
      </div>

      {item.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      )}

      {details.length > 0 && (
        <dl className="divide-y border-t pt-1">
          {details.map(([k, v]) => (
            <div key={k} className="flex gap-3 py-2 first:pt-1">
              <dt className="w-32 shrink-0 text-xs font-semibold text-foreground">
                {humanize(k)}
              </dt>
              <dd className="text-xs text-muted-foreground">
                {typeof v === "object" && v !== null ? (
                  <RenderNestedValue value={v} depth={1} />
                ) : (
                  String(v)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function AccessoriesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
          <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
