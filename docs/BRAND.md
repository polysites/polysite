# Polysite Brand Guidelines

The visual identity of the Polysite product itself: the mark, colors, type and the loading
animation, and where each lives in the codebase.

This document is the source of truth for the brand; there is no separate design-system copy elsewhere.

Polysite is the CMS product itself — not the fictional political party
content any given Polysite-powered site demos. This brand lives on the
product's own surfaces: the admin UI, the marketing site, documentation,
anywhere someone is looking at *the tool*, not a customer's content. Never
apply it to the demo sites' own branding (see CONTRIBUTING.md).

## The concept

Polysite is *poly* (many) plus *site*: one core platform that carries many sites.
The mark says it with two kinds of shape. A single upright stem is the core.
Diamonds placed beside it are the sites: one large, one smaller, each close to
the stem without becoming part of it. Every site stays independent, and every
site is held by the same core. The loading motion builds on that: sites
arriving, one after another.

## The mark

Two kinds of shape, two colors, one glyph: a long navy stem and, beside it, a
bold blue diamond with a smaller one below. Together they read as a geometric
"P". The diamonds sit close to the stem but never merge with it. That gap is
deliberate: it is the difference between "many sites on one core" and one lump.

Never redraw the shapes in a single color, never swap which shape is the
accent, and never let the diamonds fully merge with or fully separate from the
stem.

## Color

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `ink` | `#16213E` | `#F2F4F8` | The mark and wordmark; primary text |
| `ink-muted` | `#4B5565` | `#AEB7C6` | Secondary text |
| `caption` | `#8A94A6` | `#8A94A6` | The "CMS" subtitle and other quiet, tracked labels |
| `accent` | `#3E5BA6` | `#6B8FD4` | The mark's diamonds; links, focus states, primary actions |
| `accent-tint` | `#E8ECF6` | `#232B42` | Selected/hover fills |
| `surface-000` | `#FFFFFF` | `#121318` | Page background |
| `surface-100` | `#F5F6F8` | `#1B1D24` | Cards, the sidebar |
| `border` | `#E2E5EA` | `#2A2D36` | Hairlines |

The admin UI follows the person's light or dark setting, so both themes get
equal care, not a dark mode bolted on afterward.

## Type

**Lora** (serif) carries the wordmark and any display-sized heading on a
brand surface. **Inter** (sans) handles everything else — every word inside
the actual admin UI, captions, labels, body copy. The wordmark is the only
place the serif appears.

## Using the logo

- **Logo** (mark + "Polysite" + "CMS") is the default lockup.
- **Mark** alone is for anywhere the full lockup won't fit legibly:
  favicons, an app icon, a social avatar.
- **Stacked** (`logo-stacked.svg`) is for square or near-square spaces. It exists as an
  asset only; the admin has no React component for it.

Clear space: one stem-width of the mark clear on every side. Minimum size:
16px for the mark, ~120px wide for the horizontal lockup. Reversed (white)
files exist for dark or photographic backgrounds — use those rather than
forcing the ink version to work there.

## Motion: the loading mark

The one approved loading indicator: the stem holds still while the accent
diamonds drop into place one after the other, hold, and lift away again, on a
loop: sites being added to the core, repeatedly. Always paired with a text label
for screen readers; respects `prefers-reduced-motion` (falls back to a
plain opacity pulse).

## Where this lives in the codebase

- `apps/cms/public/brand/` — the production SVG assets (mark, both logo
  lockups, the reversed lockup, the favicon).
- `apps/cms/src/components/Brand/` — `Mark.tsx`, `Logo.tsx`,
  `LoadingMark.tsx`, the React versions used inside the admin.
- `payload.config.ts`'s `admin.components.graphics` (`Logo`/`Icon`) and
  `admin.meta.icons` wire the mark into the login screen, the app header,
  and the browser favicon.
- `components/AdminNav/NavClient.tsx`'s sidebar header and
  `components/AdminActions/SearchAction.tsx`'s in-flight search indicator
  are the two places the mark and the loading animation actually render
  today — new UI that needs either should reuse these components rather
  than re-implementing the shapes.
