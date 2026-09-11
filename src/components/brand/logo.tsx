import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Render only the swirl mark (collapsed sidebar / favicons). */
  collapsed?: boolean;
  className?: string;
}

/**
 * Air Master brand lockup, served from `/public`.
 * - full:      `airmaster-logo.png`       (547 x 92 wordmark)
 * - collapsed: `airmaster-logo-small.png` (200 x 200 emblem)
 *
 * `unoptimized` serves the raw image (no sharp dependency needed at runtime).
 */
export function Logo({ collapsed = false, className }: LogoProps) {
  if (collapsed) {
    return (
      <Image
        src="/air-master-logo-small.png"
        alt="Air Master"
        width={200}
        height={200}
        priority
        unoptimized
        className={cn("size-9", className)}
      />
    );
  }

  return (
    <Image
      src="/air-master-logo.png"
      alt="Air Master — Leaders In Air Distribution"
      width={547}
      height={92}
      priority
      unoptimized
      className={cn("h-12 w-auto", className)}
    />
  );
}
