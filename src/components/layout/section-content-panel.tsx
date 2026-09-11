"use client";

import { FileQuestion, type LucideIcon } from "lucide-react";

import { type SectionKey, useProductSectionContent } from "@/features/catalog";

import { AccessoryCard, type AccessoryItem } from "./accessories-panel";
import { RenderNestedValue } from "./render-nested-value";

/**
 * Connected variant: fetches a single section's content from its own endpoint
 * (`/catalog/products/:productId/parameter/:section`) and renders it. Used for
 * the open-shaped sections (construction, installation) that have no bespoke
 * panel of their own.
 */
export function SectionContentTab({
  productId,
  section,
  title,
  icon,
  emptyHint,
}: {
  productId: string;
  section: SectionKey;
  title: string;
  icon: LucideIcon;
  emptyHint: string;
}) {
  const { data, isLoading } = useProductSectionContent(productId, section);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <SectionContentPanel
      title={title}
      icon={icon}
      content={data?.content ?? null}
      emptyHint={emptyHint}
    />
  );
}

/**
 * Generic renderer for an open-shaped, per-product section payload
 * (`product.sections[key]`). Handles the common shapes the backend may store —
 * a markdown-ish string, a list, or a key/value object — and falls back to a
 * clear empty state when the product has no content for the section.
 */
export function SectionContentPanel({
  title,
  icon: Icon,
  content,
  emptyHint,
}: {
  title: string;
  icon: LucideIcon;
  content: unknown;
  emptyHint: string;
}) {
  const { main, linkedAccessories } = splitLinkedAccessories(content);

  const isEmpty =
    main == null ||
    (typeof main === "string" && main.trim() === "") ||
    (Array.isArray(main) && main.length === 0) ||
    (typeof main === "object" &&
      !Array.isArray(main) &&
      Object.keys(main as object).length === 0);

  if (isEmpty && linkedAccessories.length === 0) {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <FileQuestion className="size-8" />
          <span>No {emptyHint} have been published for this product.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {!isEmpty && (
        <div className="rounded-xl border bg-card p-6">
          <SectionBody content={main} />
        </div>
      )}

      {linkedAccessories.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-label-bold text-muted-foreground">
            Optional Accessories
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {linkedAccessories.map((item) => (
              <AccessoryCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Pulls the relationally-linked-accessories list (if any) out of a section's
 *  content so it can render as its own "Optional Accessories" block instead
 *  of going through the generic recursive renderer. */
function splitLinkedAccessories(
  content: unknown,
): { main: unknown; linkedAccessories: AccessoryItem[] } {
  if (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content) &&
    Array.isArray((content as Record<string, unknown>).linked_accessories)
  ) {
    const { linked_accessories, ...rest } = content as Record<
      string,
      unknown
    >;
    return {
      main: rest,
      linkedAccessories: linked_accessories as AccessoryItem[],
    };
  }
  return { main: content, linkedAccessories: [] };
}

function SectionBody({ content }: { content: unknown }) {
  // Markdown-ish string → paragraphs split on blank lines / newlines.
  if (typeof content === "string") {
    return (
      <div className="max-w-3xl space-y-3">
        {content
          .split(/\n{1,}/)
          .filter((p) => p.trim() !== "")
          .map((p, i) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: stable paragraph order
              key={i}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {p}
            </p>
          ))}
      </div>
    );
  }

  // Arrays and key/value objects → recursive, non-stringifying renderer.
  return <RenderNestedValue value={content} />;
}
