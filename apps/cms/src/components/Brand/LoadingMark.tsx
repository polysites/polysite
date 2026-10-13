"use client";


// Polysite's loading indicator: the stem holds still while the accent
// diamonds -- the sites -- drop into place one after the other, holds, and lifts away again,
// looping. Replaces a generic spinner anywhere the admin shows an
// indeterminate wait (see docs/BRAND.md's Motion section). Always pair with
// a visible or visually-hidden text label -- this carries no accessible
// name on its own, see the `label` prop.
export function LoadingMark({
  size = 24,
  label = "Loading",
  color,
}: {
  size?: number;
  label?: string;
  color?: string;
}) {
  return (
    <span role="status" aria-label={label} style={{ display: "inline-flex", color }}>
      <style>{`
        @keyframes polysite-drop {
          0%   { opacity: 0; transform: translateY(-26%); }
          30%  { opacity: 1; transform: translateY(2%); }
          42%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; transform: translateY(0); }
          88%  { opacity: 0; transform: translateY(8%); }
          100% { opacity: 0; transform: translateY(-26%); }
        }
        @keyframes polysite-stem-flash {
          0%, 28% { opacity: 0.35; }
          42% { opacity: 0.7; }
          60%, 100% { opacity: 0.35; }
        }
        @keyframes polysite-pulse-reduced {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .polysite-loading-mark .stem {
          animation: polysite-stem-flash 1.8s ease-in-out infinite;
        }
        .polysite-loading-mark .rhombus {
          transform-box: fill-box;
          transform-origin: center;
          animation: polysite-drop 1.8s cubic-bezier(.3,.1,.3,1) infinite;
        }
        .polysite-loading-mark .rhombus-2 { animation-delay: 0.22s; }
        @media (prefers-reduced-motion: reduce) {
          .polysite-loading-mark .stem { animation: none; opacity: 0.6; }
          .polysite-loading-mark .rhombus { animation: polysite-pulse-reduced 2.4s ease-in-out infinite; transform: none; }
        }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 100 100" className="polysite-loading-mark" aria-hidden="true">
        <polygon className="stem" points="16,12 34,12 34,88 16,88" fill="currentColor" />
        <polygon className="rhombus" points="62,8 88,34 62,60 36,34" fill="var(--polysite-accent, #3E5BA6)" />
    <polygon className="rhombus rhombus-2" points="62,64 76,78 62,92 48,78" fill="var(--polysite-accent, #3E5BA6)" />
      </svg>
    </span>
  );
}
