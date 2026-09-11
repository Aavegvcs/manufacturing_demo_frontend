"use client";

import { ArrowUpRight, GitCompareArrows, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui";
import {
  useCatalogParams,
  useCatalogStore,
  useProductOverviews,
} from "@/features/catalog";
import { cn } from "@/lib/utils";

/**
 * Full-screen product comparison overlay. Columns are the queued products, rows
 * are the union of their Overview "facts" (Product type, Material, Bar Pitch…),
 * with differing rows highlighted. Driven by the catalog store's compare state.
 */
export function CompareModal() {
  const open = useCatalogStore((s) => s.compareOpen);
  const compareIds = useCatalogStore((s) => s.compareIds);
  const closeCompare = useCatalogStore((s) => s.closeCompare);
  const removeCompare = useCatalogStore((s) => s.removeCompare);
  const clearCompare = useCatalogStore((s) => s.clearCompare);
  const { setActive } = useCatalogParams();

  const overviews = useProductOverviews(compareIds);

  // Close on Escape + lock body scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCompare();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeCompare]);

  if (!open) return null;

  const columns = compareIds.map((id, i) => ({
    id,
    overview: overviews[i]?.data,
    isLoading: overviews[i]?.isLoading ?? false,
  }));

  // Union of fact keys across all products, in first-seen order.
  const factOrder: string[] = [];
  const labelByKey: Record<string, string> = {};
  for (const col of columns) {
    for (const f of col.overview?.facts ?? []) {
      if (!(f.key in labelByKey)) {
        labelByKey[f.key] = f.label;
        factOrder.push(f.key);
      }
    }
  }
  const valueOf = (col: (typeof columns)[number], key: string) =>
    col.overview?.facts.find((f) => f.key === key)?.value ?? null;

  const viewProduct = (id: string) => {
    setActive(id);
    closeCompare();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss; Esc handled above
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compare products"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeCompare}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="size-5 text-brand" />
            <h2 className="text-base font-semibold">Compare products</h2>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
              {compareIds.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {compareIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompare}>
                Clear all
              </Button>
            )}
            <button
              type="button"
              onClick={closeCompare}
              aria-label="Close comparison"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto">
          {compareIds.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
              <GitCompareArrows className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">No products to compare yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Use “Add to comparison” on a product, or the compare button on a
                catalogue card, to line products up side by side.
              </p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-sm">
              {/* Product header row */}
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 w-44 min-w-44 border-b bg-background p-3 text-left align-bottom text-xs font-medium text-muted-foreground">
                    Attribute
                  </th>
                  {columns.map((col) => {
                    const ov = col.overview;
                    const img = ov?.images?.[0]?.url;
                    return (
                      <th
                        key={col.id}
                        className="sticky top-0 z-10 min-w-52 border-b bg-background p-3 text-left align-top"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border bg-accent/20">
                              {img ? (
                                <Image
                                  src={img}
                                  alt={ov?.name ?? ""}
                                  fill
                                  sizes="200px"
                                  className="object-contain"
                                />
                              ) : (
                                <div className="size-full animate-pulse bg-muted" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {ov?.name ??
                                  (col.isLoading ? "Loading…" : col.id)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => viewProduct(col.id)}
                              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand hover:underline"
                            >
                              View product <ArrowUpRight className="size-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCompare(col.id)}
                            aria-label={`Remove ${ov?.name ?? "product"}`}
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {factOrder.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      No comparable attributes for the selected products.
                    </td>
                  </tr>
                ) : (
                  factOrder.map((key) => {
                    const values = columns.map((c) => valueOf(c, key));
                    const present = values.filter((v) => v != null);
                    const differs =
                      present.length > 1 &&
                      !present.every((v) => v === present[0]);
                    return (
                      <tr key={key} className="group">
                        <th
                          scope="row"
                          className={cn(
                            "sticky left-0 z-10 w-44 min-w-44 border-b bg-background p-3 text-left align-top text-xs font-medium text-muted-foreground group-hover:bg-muted/40",
                            differs && "bg-amber-50/60 group-hover:bg-amber-50",
                          )}
                        >
                          {labelByKey[key]}
                        </th>
                        {columns.map((c, i) => (
                          <td
                            key={c.id}
                            className={cn(
                              "border-b p-3 align-top text-sm text-foreground group-hover:bg-muted/40",
                              differs &&
                                "bg-amber-50/60 group-hover:bg-amber-50",
                            )}
                          >
                            {values[i] ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
