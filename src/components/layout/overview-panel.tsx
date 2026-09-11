"use client";

import {
  Cog,
  Droplet,
  Gauge,
  Info,
  Layers,
  LayoutGrid,
  type LucideIcon,
  Paintbrush,
  PencilRuler,
  RotateCw,
  Ruler,
  Settings2,
  ShieldCheck,
  Tag,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  type ProductFact,
  resolveFacts,
  signatureMatches,
  useCatalogParams,
  useProductOverview,
} from "@/features/catalog";
import { cn } from "@/lib/utils";

/** Fact values at or under this length stay in the compact card grid; longer
 * ones (formulas, operating principles) move to a full-width row instead. */
const FACT_DETAIL_THRESHOLD = 60;

/** The handful of facts every product carries — exact-matched for speed. */
const FACT_ICON: Record<string, LucideIcon> = {
  product_type: PencilRuler,
  application: LayoutGrid,
  installation: Settings2,
  material: Layers,
  finish: Paintbrush,
};

/**
 * Everything else comes from a product's free-form `specs` (model numbers,
 * dimensions, airflow/pressure ratings, certifications, moving parts…), so
 * exact keys can't be enumerated. Match by keyword instead — ordered most
 * specific to most generic, same pattern as the sidebar's category icons.
 */
const FACT_ICON_RULES: { match: string[]; icon: LucideIcon }[] = [
  // Model / part identifiers
  { match: ["model", "format", "panel_units"], icon: Tag },
  // Moving / powered components
  {
    match: [
      "actuator",
      "motor",
      "fan",
      "coil",
      "damper",
      "mechanism",
      "closure_device",
      "electrical",
      "uv_light",
      "linkage",
    ],
    icon: Cog,
  },
  // Drainage / moisture
  { match: ["drain"], icon: Droplet },
  // Blade movement / airflow orientation
  { match: ["blade", "rotation", "tilt", "pattern", "operation"], icon: RotateCw },
  // Sizing & dimensions
  {
    match: [
      "_mm",
      "_in",
      "dia",
      "length",
      "width",
      "height",
      "depth",
      "pitch",
      "tolerance",
      "increment",
      "flange",
      "size",
    ],
    icon: Ruler,
  },
  // Airflow / pressure / thermal performance
  {
    match: [
      "cfm",
      "velocity",
      "pressure",
      "flow",
      "turndown",
      "temperature",
      "temp",
      "leakage",
      "area_pct",
      "signal",
      "equation",
    ],
    icon: Gauge,
  },
  // Certifications / standards / fire rating
  { match: ["standard", "certificat", "rating", "tested_for"], icon: ShieldCheck },
  // Material / construction
  {
    match: [
      "casing",
      "frame",
      "insulation",
      "infill",
      "baffle",
      "splitter",
      "shape",
      "seal",
      "pod",
    ],
    icon: Layers,
  },
  // Mounting / connection
  {
    match: [
      "mount",
      "connection",
      "inlet_type",
      "joint",
      "plenum",
      "separation",
      "ventilation_type",
      "control",
    ],
    icon: Settings2,
  },
];

function iconForFact(key: string): LucideIcon {
  if (key in FACT_ICON) return FACT_ICON[key];
  const k = key.toLowerCase();
  for (const { match, icon } of FACT_ICON_RULES) {
    if (match.some((m) => k.includes(m))) return icon;
  }
  return Info;
}

export function OverviewPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductOverview(productId);
  const { selections } = useCatalogParams();
  const selection = selections[productId] ?? {};

  if (isLoading) return <OverviewSkeleton />;
  if (!data) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No overview is available for this product.
      </div>
    );
  }

  // Thumbnails always show every published photo — matching only decides
  // which one starts active. De-dupe by URL first: the same photo can be
  // tagged to more than one option value (e.g. one double-deflection shot
  // covers both HV and VH), which would otherwise render as two identical
  // thumbnails.
  const rawImages = data.images ?? [];
  const images = Array.from(
    new Map(rawImages.filter((im) => im.url).map((im) => [im.url, im])).values(),
  ).map((im) => im.url);
  // First url whose *any* tagged entry matches the current selection — falls
  // back to index 0 (the default/first photo) when nothing does, including
  // for every product whose images carry no `match` at all.
  const activeIndex = Math.max(
    0,
    images.findIndex((url) =>
      rawImages.some((im) => im.url === url && signatureMatches(im.match, selection)),
    ),
  );

  // Layer any variant-scoped overrides for the current selection onto the
  // base facts (e.g. Flange mm differs by Blade Orientation) — a no-op for
  // the majority of products that don't define spec_variants.
  const facts = resolveFacts(data.facts, data.specVariants, selection);

  // Specs are free-form: some are short ("Galvanized steel"), some are whole
  // sentences (formulas, operating principles). Squeezing the long ones into
  // the same 3-column card grid as the short ones makes every card as tall as
  // the longest value. Split by length instead: short facts keep the compact
  // grid, long ones get a full-width row with room to actually read.
  const shortFacts = facts.filter((f) => f.value.length <= FACT_DETAIL_THRESHOLD);
  const longFacts = facts.filter((f) => f.value.length > FACT_DETAIL_THRESHOLD);

  return (
    <div className="space-y-6 pb-8">
      {/* Hero carousel — full width so the product image reads large. */}
      <ImageCarousel images={images} alt={data.name} activeIndex={activeIndex} />

      {/* Illustrative-image note — right under the image it qualifies. */}
      <div className="flex items-center gap-2 rounded-lg border bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        <span>
          Pictures are only illustrative. They can differ from the visual shape
          of the selected product variant.
        </span>
      </div>

      {/* Spec facts / highlights — a responsive grid so a long list of
          highlights flows into columns instead of a tall single column. */}
      {shortFacts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortFacts.map((f) => (
            <FactRow key={f.key} fact={f} />
          ))}
        </div>
      )}

      {/* Longer specs (formulas, operating principles, multi-clause notes) —
          full-width rows instead of cramped into the card grid above. */}
      {longFacts.length > 0 && (
        <div className="space-y-3">
          {longFacts.map((f) => (
            <FactDetailRow key={f.key} fact={f} />
          ))}
        </div>
      )}

      {/* Description */}
      {data.description && (
        <section className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Description</h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Preview with a vertical thumbnail rail alongside it, saving vertical space.
 * `activeIndex` picks which thumbnail starts selected (the one matching the
 * current option selection) — the user can still click any other thumbnail
 * afterward, and that choice sticks until `activeIndex` itself changes (i.e.
 * the selection changes to one that resolves to a different photo).
 */
function ImageCarousel({
  images,
  alt,
  activeIndex,
}: {
  images: string[];
  alt: string;
  activeIndex: number;
}) {
  const [active, setActive] = useState(activeIndex);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-syncs only when the resolved index itself changes, not on every render
  useEffect(() => {
    setActive(activeIndex);
  }, [activeIndex]);
  const current = images[active] ?? images[0];

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border p-4 bg-accent/20 sm:grid-cols-[8.5fr_1.5fr]">
      {/* Main image — a fixed 70% column so its width never depends on the
          image's own size; the thumbnail column stays pinned to the right
          edge of the container regardless. */}
      <div className="relative flex min-h-[320px] items-center justify-center rounded-lg">
        {images.length > 0 && (
          <span className="absolute top-0 left-0 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground tabular-nums">
            {active + 1} / {images.length}
          </span>
        )}
        {current ? (
          <Image
            src={current}
            alt={alt}
            fill
            priority
            sizes="(min-width: 640px) 55vw, 90vw"
            className="py-6 px-2 object-contain"
          />
        ) : (
          <div className="text-sm text-muted-foreground">No image available</div>
        )}
      </div>

      {/* Thumbnail rail — fixed column flush with the container's right edge;
          each thumbnail stretches to fill the column's full width (instead of
          a fixed size that leaves dead space beside it) and stacks in a single
          column; on mobile it's a fixed-size horizontally scrolling strip. */}
      {images.length > 1 && (
        <div className="scrollbar-thin flex gap-3 overflow-x-auto sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border p-2 transition-colors sm:size-auto sm:aspect-square sm:w-full sm:shrink-0",
                i === active
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-primary/40",
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(min-width: 640px) 20vw, 80px"
                className="object-contain p-2"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FactRow({ fact }: { fact: ProductFact }) {
  const Icon = iconForFact(fact.key);
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary">{fact.label}</p>
        <p className="text-[15px] font-bold leading-snug text-foreground">
          {fact.value}
        </p>
      </div>
    </div>
  );
}

/** Full-width row for facts too long to fit a card without dwarfing its
 * neighbors — plain paragraph text instead of the grid's bold single-line
 * value. */
function FactDetailRow({ fact }: { fact: ProductFact }) {
  const Icon = iconForFact(fact.key);
  return (
    <div className="flex items-start gap-4 rounded-2xl border bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary">{fact.label}</p>
        <p className="text-sm leading-relaxed text-foreground">{fact.value}</p>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-24 max-w-3xl animate-pulse rounded bg-muted" />
    </div>
  );
}
