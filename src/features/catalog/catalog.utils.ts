import type { CatalogNode, ProductFact, SpecVariant } from "./catalog.types";

/**
 * Does a dataset's option `signature` apply to the current selection?
 *
 * A signature is a partial option spec (e.g. `{core_pattern: "4-way"}`); `{}`
 * means "applies to every configuration". Only keys that are **also present in
 * the current selection** are evaluated — signature keys that don't correspond
 * to any user-selectable parameter are ignored. This lets seeds store
 * descriptive metadata (e.g. `{mode:"supply", deflection:"one-way"}`) without
 * having to expose those as product options.
 */
export function signatureMatches(
  signature: Record<string, string> | undefined,
  selection: Record<string, string>,
): boolean {
  if (!signature) return true;
  return Object.entries(signature).every(
    ([key, value]) => !(key in selection) || selection[key] === value,
  );
}

/**
 * Filters a list of `match`-tagged items (images, drawings) down to the ones
 * applying to the current option selection, using the same partial-match rule
 * as {@link signatureMatches}. Never returns an empty list when the input
 * wasn't empty — falls back to showing everything rather than going blank.
 */
export function filterByMatch<T extends { match?: Record<string, string> }>(
  items: T[],
  selection: Record<string, string>,
): T[] {
  if (items.length === 0) return items;
  const matched = items.filter((item) =>
    signatureMatches(item.match, selection),
  );
  return matched.length > 0 ? matched : items;
}

const humanizeKey = (key: string): string =>
  key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Layers a product's `spec_variants` onto its base Overview facts for the
 * current option selection — same partial-match rule as {@link filterByMatch}
 * (a variant's `match` only checks keys it sets; omitted `match` applies to
 * every selection). Every variant satisfied by `selection` contributes its
 * `values`, in array order (later variants win on key conflict): a value that
 * overrides an existing fact replaces its display value in place, and a value
 * for a key with no existing fact is appended as a new one. Returns `facts`
 * unchanged when there's nothing to apply, so products without variants pay
 * zero cost and render exactly as before.
 */
export function resolveFacts(
  facts: ProductFact[],
  specVariants: SpecVariant[] | undefined,
  selection: Record<string, string>,
): ProductFact[] {
  if (!specVariants || specVariants.length === 0) return facts;

  const overrides: Record<string, unknown> = {};
  for (const variant of specVariants) {
    if (signatureMatches(variant.match, selection)) {
      Object.assign(overrides, variant.values);
    }
  }
  if (Object.keys(overrides).length === 0) return facts;

  // Match keys case-insensitively: the admin's override editor and the base
  // Specifications editor are two separate free-text inputs, so an override
  // meant to replace an existing fact (e.g. "Material") can easily end up a
  // different case than the base spec key (e.g. "material") — without this,
  // that typo silently adds a duplicate fact instead of overriding the real
  // one. `overrideKeyByLower` keeps the override's own casing for lookup.
  const overrideKeyByLower = new Map(
    Object.keys(overrides).map((k) => [k.toLowerCase(), k]),
  );
  const seenKeysLower = new Set(facts.map((f) => f.key.toLowerCase()));
  const merged = facts.map((f) => {
    const overrideKey = overrideKeyByLower.get(f.key.toLowerCase());
    return overrideKey !== undefined
      ? { ...f, value: String(overrides[overrideKey]) }
      : f;
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (
      !seenKeysLower.has(key.toLowerCase()) &&
      value != null &&
      typeof value !== "object"
    ) {
      merged.push({ key, label: humanizeKey(key), value: String(value) });
    }
  }
  return merged;
}

/** Finds a node anywhere in the tree by id (depth-agnostic). */
export function findNode(nodes: CatalogNode[], id: string): CatalogNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns a pruned copy of the tree containing only nodes whose name matches
 * `query`, plus the ancestors needed to reach them. Empty query returns the
 * tree unchanged. Pure and recursive — depth-agnostic.
 */
export function filterCatalog(
  nodes: CatalogNode[],
  query: string,
): CatalogNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const walk = (list: CatalogNode[]): CatalogNode[] => {
    const result: CatalogNode[] = [];
    for (const node of list) {
      const selfMatches = node.name.toLowerCase().includes(q);
      const matchedChildren = node.children ? walk(node.children) : [];

      // Keep a node if it matches directly, or if any descendant matches.
      if (selfMatches || matchedChildren.length > 0) {
        result.push({
          ...node,
          children: selfMatches ? node.children : matchedChildren,
        });
      }
    }
    return result;
  };

  return walk(nodes);
}

/** Finds the chain of ancestor ids leading to `targetId` (inclusive of it). */
export function findPath(
  nodes: CatalogNode[],
  targetId: string,
): string[] | null {
  const nodePath = findNodePath(nodes, targetId);
  return nodePath ? nodePath.map((n) => n.id) : null;
}

/** Like {@link findPath} but returns the full nodes — useful for breadcrumbs. */
export function findNodePath(
  nodes: CatalogNode[],
  targetId: string,
): CatalogNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    if (node.children) {
      const childPath = findNodePath(node.children, targetId);
      if (childPath) return [node, ...childPath];
    }
  }
  return null;
}

/**
 * URL slug for a node — the final segment of its id, after stripping an optional
 * "kind:" prefix. Backend category ids embed the full hierarchical path
 * ("cat:/grille/linear-grille") and product ids a flat slug ("prod:cle"); taking
 * the last segment collapses both to a single clean token ("linear-grille",
 * "cle") so the path reads "/grille/linear-grille/cle" without repeating
 * ancestors or encoding embedded slashes. Mock ids (plain slugs like "nova-a")
 * pass through unchanged. The slugs sharing a parent stay unique, since sibling
 * paths differ in their last segment and product slugs are globally unique.
 */
export function nodeSlug(node: CatalogNode): string {
  const afterKind = node.id.slice(node.id.indexOf(":") + 1);
  const parts = afterKind.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : afterKind;
}

/**
 * Resolve a chain of URL slug segments (e.g. ["grilles","floor-grilles",
 * "terra-f"]) to the node it addresses, walking the tree level by level.
 * Returns null if any segment doesn't match a child at its level.
 */
export function resolveNodeByPath(
  nodes: CatalogNode[],
  segments: string[],
): CatalogNode | null {
  let level: CatalogNode[] | undefined = nodes;
  let node: CatalogNode | null = null;
  for (const seg of segments) {
    const match: CatalogNode | undefined = level?.find(
      (n) => nodeSlug(n) === seg,
    );
    if (!match) return null;
    node = match;
    level = match.children;
  }
  return node;
}

/**
 * Build the URL path ("/a/b/c") that addresses `targetId` from its ancestor
 * chain, or "/" when the id isn't in the tree. Each segment is percent-encoded
 * so non-ascii names stay valid in the address bar.
 */
export function pathForNode(nodes: CatalogNode[], targetId: string): string {
  const chain = findNodePath(nodes, targetId);
  if (!chain) return "/";
  return `/${chain.map((n) => encodeURIComponent(nodeSlug(n))).join("/")}`;
}
