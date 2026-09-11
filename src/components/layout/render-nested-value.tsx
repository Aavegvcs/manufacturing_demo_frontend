"use client";

export const humanize = (key: string): string =>
  key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const MAX_DEPTH = 4;

/**
 * Recursively renders an open-shaped JSON value instead of JSON.stringify-ing
 * it: arrays of primitives become a bullet list, arrays of objects become a
 * stack of nested definition blocks, and objects become definition rows with
 * humanized keys, recursing into any nested object/array value. Depth is
 * capped, and every nested level below the top gets a left border + indent so
 * the structure stays legible.
 */
export function RenderNestedValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  const body = renderBody(value, depth);
  if (body == null) return null;
  if (depth === 0) return <>{body}</>;
  return (
    <div className="border-l-2 border-border-industrial/50 pl-3">{body}</div>
  );
}

function renderBody(value: unknown, depth: number) {
  if (value == null) return null;

  if (depth >= MAX_DEPTH) {
    return (
      <span className="text-sm text-muted-foreground">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    const hasObjectItems = value.some(
      (item) => typeof item === "object" && item !== null,
    );
    if (hasObjectItems) {
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list order
            <RenderNestedValue key={i} value={item} depth={depth + 1} />
          ))}
        </div>
      );
    }

    return (
      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground">
        {value.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable list order
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v != null,
    );
    if (entries.length === 0) return null;

    return (
      <dl className="divide-y">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="w-40 shrink-0 text-sm font-semibold text-foreground">
              {humanize(k)}
            </dt>
            <dd className="flex-1 text-sm text-muted-foreground">
              {typeof v === "object" ? (
                <RenderNestedValue value={v} depth={depth + 1} />
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <span className="text-sm text-muted-foreground">{String(value)}</span>
  );
}
