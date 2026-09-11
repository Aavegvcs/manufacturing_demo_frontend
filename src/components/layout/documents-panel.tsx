"use client";

import { Download, FileText, Globe, Mail, Phone } from "lucide-react";

import { useProductSectionContent } from "@/features/catalog";

/** Shape of the `downloads` section content served by the backend. */
interface CatalogInfo {
  title?: string;
  series?: string;
  catalog_code?: string;
}
interface Manufacturer {
  name?: string;
  address?: string;
  tel?: string[];
  email?: string[];
  website?: string;
}
/** A single downloadable document (S3-hosted PDF, catalogue or category brochure). */
interface DownloadFile {
  url: string;
  type?: string;
  label?: string;
  size_label?: string;
}
interface DownloadsContent {
  catalog?: CatalogInfo;
  disclaimer?: string;
  manufacturer?: Manufacturer;
  files?: DownloadFile[];
}

/**
 * Downloads tab — driven by the product's own `downloads` endpoint
 * (`/catalog/products/:id/downloads`): one or more downloadable PDF
 * catalogues (`files`, S3-hosted, most-specific first), optional catalog
 * metadata, the manufacturer's contact details, and the legal disclaimer.
 */
export function DocumentsPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useProductSectionContent(productId, "downloads");

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const content = (data?.content ?? null) as DownloadsContent | null;
  if (!content) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No downloads have been published for this product.
      </div>
    );
  }

  const { catalog, manufacturer, disclaimer, files } = content;

  return (
    <div className="space-y-6 pb-8">
      {catalog && (
        <div>
          <h3 className="font-semibold text-foreground">{catalog.title}</h3>
          <p className="text-xs text-muted-foreground">
            {catalog.series}
            {catalog.catalog_code ? ` · Code ${catalog.catalog_code}` : ""}
          </p>
        </div>
      )}

      {files && files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <article
              key={file.url}
              className="flex items-center gap-4 rounded-lg border bg-card p-4"
            >
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FileText className="size-5" strokeWidth={1.75} />
                <span className="mt-0.5 text-[0.625rem] font-bold tracking-wide">
                  {(file.type ?? "pdf").toUpperCase()}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold text-foreground">
                  {file.label ?? "Product Catalogue"}
                </h4>
                {file.size_label && (
                  <p className="text-xs text-muted-foreground">
                    {file.size_label}
                  </p>
                )}
              </div>

              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                aria-label={`Download ${file.label ?? "document"}`}
                data-product={productId}
                className="inline-flex shrink-0 items-center gap-1.5 rounded font-semibold text-brand transition-colors hover:text-primary hover:underline"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </article>
          ))}
        </div>
      )}

      {manufacturer && (
        <section className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold text-foreground">{manufacturer.name}</h3>
          {manufacturer.address && (
            <p className="mt-1 text-sm text-muted-foreground">
              {manufacturer.address}
            </p>
          )}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {manufacturer.tel && manufacturer.tel.length > 0 && (
              <ContactRow
                icon={Phone}
                label="Telephone"
                values={manufacturer.tel}
              />
            )}
            {manufacturer.email && manufacturer.email.length > 0 && (
              <ContactRow
                icon={Mail}
                label="Email"
                values={manufacturer.email}
              />
            )}
            {manufacturer.website && (
              <ContactRow
                icon={Globe}
                label="Website"
                values={[manufacturer.website]}
              />
            )}
          </dl>
        </section>
      )}

      {disclaimer && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {disclaimer}
        </p>
      )}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  values,
}: {
  icon: typeof Phone;
  label: string;
  values: string[];
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-foreground">{label}</dt>
        {values.map((v) => (
          <dd key={v} className="truncate text-sm text-muted-foreground">
            {v}
          </dd>
        ))}
      </div>
    </div>
  );
}
