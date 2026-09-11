"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useCatalogTree } from "./catalog.queries";
import { pathForNode, resolveNodeByPath } from "./catalog.utils";

/**
 * URL-backed catalog navigation + configuration state.
 *
 * The URL is the single source of truth for everything the user can "lose" on a
 * refresh: the active node, the open tab, the configuration selection, and the
 * calculation operating point. Keeping it here (instead of an in-memory store)
 * means a reload or a shared link restores the exact view.
 *
 * The active node lives in the *path* so links read as a clear hierarchy, e.g.
 *   /grilles/wall-and-ceiling-grilles/nova-a?sel=frame_type:C&flow=110&tab=overview
 * Each path segment is a node slug ({@link nodeSlug}); an empty path is the
 * catalogue root. Per-product detail state stays in the query string:
 *   tab    — active section key for a product detail
 *   sel    — current product's selection, "key:value" pairs joined by ","
 *   grp    — calculation size/group
 *   flow   — calculation air flow (number)
 *   tb     — calculation throw basis (e.g. "sidewall" / "sill")
 *   tv     — calculation throw terminal velocity in fpm (e.g. "150")
 *   throw  — legacy combined throw column key, still read for old links
 *   hgt    — duct height in mm (damper velocity calculator)
 *
 * Selection/calc are scoped to the active product: navigating to another node
 * resets them (the new path carries no query), mirroring the previous
 * per-product store behaviour.
 *
 * The ":" / "," delimiters are written unencoded (see `commit`) so the query
 * reads as ?sel=frame_type:C,deflection:00 rather than %3A/%2C noise.
 */

export interface CalcInput {
  group?: string;
  airflow?: number;
  /** Throw basis, e.g. "sidewall" / "sill". */
  throwBasis?: string;
  /** Throw terminal velocity in fpm, kept as a string for URL equality. */
  throwVel?: string;
  /** Grille length in millimetres (linear grille products). */
  lengthMm?: number;
  /** Grille width/height in millimetres (linear grille products); also the
   *  duct width for the damper velocity calculator (shares this field). */
  widthMm?: number;
  /** Duct height in millimetres (damper velocity calculator). */
  heightMm?: number;
  /** Total airflow in CFM before per-foot conversion (linear grille products). */
  totalCfm?: number;
  /** Slot gap in mm (slot diffusers). */
  slotGap?: number;
  /** Number of slots (slot diffusers). */
  slotsCount?: number;
  /** Selected plenum dataset ID (slot diffusers). */
  plenumId?: string;
  /** Selected target required length in ft (slot diffusers). */
  targetLength?: number;
}

const PAIR_SEP = ",";
const KV_SEP = ":";

/** Split a legacy combined throw key like `throw_sidewall_150fpm_ft`. */
function parseLegacyThrow(key: string): { basis: string; vel: string } | null {
  const m = /throw_([a-z]+)_(\d+)fpm/i.exec(key);
  return m ? { basis: m[1].toLowerCase(), vel: m[2] } : null;
}

function parseSelection(raw: string | null): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(PAIR_SEP)) {
    const i = pair.indexOf(KV_SEP);
    if (i > 0) out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

function serializeSelection(sel: Record<string, string>): string {
  return Object.entries(sel)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}${KV_SEP}${v}`)
    .join(PAIR_SEP);
}

export function useCatalogParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: tree = [] } = useCatalogTree();

  // The active node is addressed by the path: each segment is a node slug.
  // Resolution needs the tree, so `activeId` is null until it loads — the same
  // window in which `findNode(tree, …)` returned null before, so no view regresses.
  const segments = useMemo(
    () =>
      pathname
        .split("/")
        .filter(Boolean)
        .map((s) => {
          try {
            return decodeURIComponent(s);
          } catch {
            return s;
          }
        }),
    [pathname],
  );
  const activeId = useMemo(
    () =>
      segments.length && tree.length
        ? (resolveNodeByPath(tree, segments)?.id ?? null)
        : null,
    [tree, segments],
  );

  const tab = searchParams.get("tab");
  const selRaw = searchParams.get("sel");
  const grp = searchParams.get("grp");
  const flow = searchParams.get("flow");
  const tb = searchParams.get("tb");
  const tv = searchParams.get("tv");
  const legacyThrow = searchParams.get("throw");
  const lenRaw = searchParams.get("len");
  const widRaw = searchParams.get("wid");
  const hgtRaw = searchParams.get("hgt");
  const cfmRaw = searchParams.get("cfm");
  const sgRaw = searchParams.get("sg");
  const scRaw = searchParams.get("sc");
  const plRaw = searchParams.get("pl");
  const tlRaw = searchParams.get("tl");

  // Selections/calc are exposed as maps keyed by the active product id so call
  // sites can keep reading `selections[productId]` / `calc[productId]`. Only the
  // active product is ever present in the URL, which is the only one rendered.
  const selections = useMemo<Record<string, Record<string, string>>>(() => {
    if (!activeId || selRaw == null) return {};
    return { [activeId]: parseSelection(selRaw) };
  }, [activeId, selRaw]);

  const calc = useMemo<Record<string, CalcInput>>(() => {
    if (!activeId) return {};
    const c: CalcInput = {};
    if (grp) c.group = grp;
    if (flow != null && flow !== "" && Number.isFinite(Number(flow))) {
      c.airflow = Number(flow);
    }
    // Prefer the compact tb/tv params; fall back to the legacy combined key.
    const legacy = legacyThrow ? parseLegacyThrow(legacyThrow) : null;
    const basis = tb ?? legacy?.basis;
    const vel = tv ?? legacy?.vel;
    if (basis) c.throwBasis = basis;
    if (vel) c.throwVel = vel;
    if (lenRaw != null && Number.isFinite(Number(lenRaw)))
      c.lengthMm = Number(lenRaw);
    if (widRaw != null && Number.isFinite(Number(widRaw)))
      c.widthMm = Number(widRaw);
    if (hgtRaw != null && Number.isFinite(Number(hgtRaw)))
      c.heightMm = Number(hgtRaw);
    if (cfmRaw != null && Number.isFinite(Number(cfmRaw)))
      c.totalCfm = Number(cfmRaw);
    if (sgRaw != null && Number.isFinite(Number(sgRaw)))
      c.slotGap = Number(sgRaw);
    if (scRaw != null && Number.isFinite(Number(scRaw)))
      c.slotsCount = Number(scRaw);
    if (plRaw != null && plRaw !== "")
      c.plenumId = plRaw;
    if (tlRaw != null && Number.isFinite(Number(tlRaw)))
      c.targetLength = Number(tlRaw);
    return Object.keys(c).length ? { [activeId]: c } : {};
  }, [
    activeId,
    grp,
    flow,
    tb,
    tv,
    legacyThrow,
    lenRaw,
    widRaw,
    hgtRaw,
    cfmRaw,
    sgRaw,
    scRaw,
    plRaw,
    tlRaw,
  ]);

  const commit = useCallback(
    (mutate: (p: URLSearchParams) => void, push = false) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // URLSearchParams percent-encodes ":" and "," which we use purely as
      // human-readable delimiters in `node` and `sel`. Both are legal unencoded
      // in a query component (RFC 3986), and none of our values contain them, so
      // restore them to keep shared/copied links readable. Parsing is
      // unaffected — searchParams.get() decodes literal and encoded forms alike.
      const qs = params.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
      const url = qs ? `${pathname}?${qs}` : pathname;
      const opts = { scroll: false } as const;
      if (push) router.push(url, opts);
      else router.replace(url, opts);
    },
    [router, pathname, searchParams],
  );

  /**
   * Navigate to a node by routing to its path (or "/" for the catalogue root).
   * Pushes a history entry and, because the new path carries no query string,
   * resets per-product detail state (tab/selection/calc).
   */
  const setActive = useCallback(
    (id: string | null) => {
      const url = id ? pathForNode(tree, id) : "/";
      router.push(url, { scroll: false });
    },
    [router, tree],
  );

  const setTab = useCallback(
    (value: string) => commit((p) => p.set("tab", value)),
    [commit],
  );

  /** Merge configuration values for the active product into the URL. */
  const setSelection = useCallback(
    (_productId: string, values: Record<string, string>) => {
      commit((p) => {
        const merged = { ...parseSelection(p.get("sel")), ...values };
        const s = serializeSelection(merged);
        if (s) p.set("sel", s);
        else p.delete("sel");
      });
    },
    [commit],
  );

  /** Merge calculation operating-point inputs for the active product. */
  const setCalc = useCallback(
    (_productId: string, patch: CalcInput) => {
      commit((p) => {
        if (patch.group !== undefined) {
          // Empty group = no group dimension; drop the param instead of "grp=".
          if (patch.group) p.set("grp", patch.group);
          else p.delete("grp");
        }
        if (patch.airflow !== undefined) p.set("flow", String(patch.airflow));
        if (patch.throwBasis !== undefined || patch.throwVel !== undefined) {
          // Once the user touches the throw controls, drop the legacy key so the
          // URL carries a single, compact source of truth.
          p.delete("throw");
        }
        if (patch.throwBasis !== undefined) p.set("tb", patch.throwBasis);
        if (patch.throwVel !== undefined) p.set("tv", patch.throwVel);
        if (patch.lengthMm !== undefined) {
          if (patch.lengthMm) p.set("len", String(patch.lengthMm));
          else p.delete("len");
        }
        if (patch.widthMm !== undefined) {
          if (patch.widthMm) p.set("wid", String(patch.widthMm));
          else p.delete("wid");
        }
        if (patch.heightMm !== undefined) {
          if (patch.heightMm) p.set("hgt", String(patch.heightMm));
          else p.delete("hgt");
        }
        if (patch.totalCfm !== undefined) {
          if (patch.totalCfm) p.set("cfm", String(patch.totalCfm));
          else p.delete("cfm");
        }
        if (patch.slotGap !== undefined) {
          if (patch.slotGap) p.set("sg", String(patch.slotGap));
          else p.delete("sg");
        }
        if (patch.slotsCount !== undefined) {
          if (patch.slotsCount) p.set("sc", String(patch.slotsCount));
          else p.delete("sc");
        }
        if (patch.plenumId !== undefined) {
          if (patch.plenumId) p.set("pl", patch.plenumId);
          else p.delete("pl");
        }
        if (patch.targetLength !== undefined) {
          if (patch.targetLength) p.set("tl", String(patch.targetLength));
          else p.delete("tl");
        }
      });
    },
    [commit],
  );

  return {
    activeId,
    tab,
    selections,
    calc,
    setActive,
    setTab,
    setSelection,
    setCalc,
  };
}
