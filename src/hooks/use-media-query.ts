"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media-query subscription. Returns `false` on the server and on the
 * first client render, then syncs to the real match after mount — so it never
 * triggers a hydration mismatch. Re-evaluates as the viewport crosses the query.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * True below Tailwind's `md` breakpoint (viewport < 768px). The catalog shell
 * uses this to switch its side panels from persistent columns to overlay
 * drawers.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
