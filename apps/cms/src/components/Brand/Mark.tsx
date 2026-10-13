import type { CSSProperties } from "react";


// The icon-only glyph from brand/mark.svg, inlined rather than <img>'d so it
// can inherit color (the stem is currentColor -- set `color` via `style`,
// e.g. var(--theme-text), so it follows whatever background it's on) --
// see docs/BRAND.md for the full guidelines. The accent rhombus reads
// the admin stylesheet's theme-aware --polysite-accent rather than a fixed hex, so it
// still holds contrast if this ever renders directly on a dark surface
// with no `color` override.
export function Mark({
  size = 24,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        style={style}
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="16,12 34,12 34,88 16,88" fill="currentColor" />
        <polygon points="62,8 88,34 62,60 36,34" fill="var(--polysite-accent, #3E5BA6)" />
    <polygon points="62,64 76,78 62,92 48,78" fill="var(--polysite-accent, #3E5BA6)" />
      </svg>
    </>
  );
}
