"use client";

import Image from "next/image";

// Real logo — the client's actual final artwork file (CHS LOGO PRO),
// used directly rather than the earlier hand-drawn SVG approximation.
// That approximation was the source of a genuine, unresolved dispute
// over the "H" shape (see handover notes) — using the real file
// removes the guesswork entirely.
export default function ChsLogo({ width = 320 }: { width?: number }) {
  const height = Math.round(width * (870 / 1808)); // real asset's native aspect ratio
  return (
    <Image
      src="/brand/chs-logo-full.png"
      alt="Complete Housing Solutions"
      width={width}
      height={height}
      priority
      style={{ width, height, objectFit: "contain" }}
    />
  );
}
