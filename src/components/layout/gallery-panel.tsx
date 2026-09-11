"use client";

import { Info } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useProductOverview } from "@/features/catalog";

/**
 * Gallery tab — large preview with a thumbnail strip, driven by the product's
 * overview images. Selecting a thumbnail swaps the main preview.
 */
export function GalleryPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductOverview(productId);
  const [active, setActive] = useState(0);

  if (isLoading) return <GallerySkeleton />;

  const apiImages = (data?.images ?? []).filter((im) => im.url);
  const images = apiImages.map((im) => ({ url: im.url, alt: im.alt ?? data?.name }));
  const current = images[active];

  return (
    <div className="space-y-6 pb-8">
      {/* Main preview */}
      <div className="relative flex min-h-[320px] items-center justify-center rounded-xl border bg-muted/30 p-8">
        {current ? (
          <Image
            src={current.url}
            alt={current.alt ?? data?.name ?? "Product image"}
            fill
            priority
            sizes="(min-width: 640px) 60vw, 90vw"
            className="object-contain p-8"
          />
        ) : (
          <div className="text-sm text-muted-foreground">No image available</div>
        )}
      </div>

      {/* Thumbnail rail */}
      {images.length > 1 && (
        <div className="scrollbar-thin flex gap-3 overflow-x-auto sm:w-24 sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card p-2 transition-colors",
                i === active
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-primary/40",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `Thumbnail ${i + 1}`}
                fill
                sizes="80px"
                className="object-contain p-2"
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        <span>
          Pictures are only illustrative. They can differ from the visual shape
          of the selected product variant.
        </span>
      </div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
          <div key={i} className="size-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
