
// The full lockup (mark + "Polysite" + "CMS"), used as admin.components.
// graphics.Logo (payload.config.ts) -- Payload's login screen. Lora and Inter come from the
// admin stylesheet (app/(payload)/custom.scss, self-hosted woff2 in public/fonts); nothing is
// fetched from another site.
//
// Ink and the accent rhombus both read from the admin stylesheet's theme-aware custom
// properties, not a fixed hex -- the login screen's background is dark by
// default, and the light-theme navy used here originally was nearly
// invisible against it.
export function Logo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={220} height={52} viewBox="0 0 420 100" aria-label="Polysite CMS">
        <g transform="translate(8,10) scale(0.8)">
          <polygon points="16,12 34,12 34,88 16,88" fill="var(--polysite-ink, #16213E)" />
          <polygon points="62,8 88,34 62,60 36,34" fill="var(--polysite-accent, #3E5BA6)" />
    <polygon points="62,64 76,78 62,92 48,78" fill="var(--polysite-accent, #3E5BA6)" />
        </g>
        <text x="110" y="58" fontFamily="'Lora', Georgia, serif" fontSize={44} fontWeight={600} fill="var(--polysite-ink, #16213E)">
          Polysite
        </text>
        <text x="112" y="80" fontFamily="Inter, Arial, sans-serif" fontSize={13} fontWeight={600} letterSpacing={4} fill="var(--theme-elevation-500, #8A94A6)">
          CMS
        </text>
      </svg>
    </div>
  );
}
