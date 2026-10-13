"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { formatAdminURL } from "payload/shared";
import { Link, useConfig, useNav } from "@payloadcms/ui";
import { EntityType, type NavGroupType } from "@payloadcms/ui/shared";

import { SiteSwitcher } from "./SiteSwitcher";
import { AccountMenu } from "./AccountMenu";
import { CloseIcon, DashboardIcon, MODULE_ICONS, PathIcon } from "./icons";
import { Mark } from "../Brand/Mark";
import { installAdminA11y } from "../A11y/adminA11y";

// The design mockup's active-nav-item accent
// -- a fixed indigo identity color, not a semantic state, so it's intentionally
// NOT one of Payload's --theme-success-* tokens (those are green/blue and
// shift with the theme; swapping them in here was the actual root cause of
// "wireframe and actual dashboard do not match"). Separate from the brand's
// own navy/blue mark (see docs/BRAND.md) -- this one's scoped to in-app
// selection state, not the logo.
const ACCENT_ACTIVE_BG = "rgba(124, 124, 224, 0.14)";
const ACCENT_ACTIVE_TEXT = "var(--polysite-nav-active-text)";

// Groups the user actually approved render Content above Administration --
// groupNavItems() itself sorts groups alphabetically, which flips that order
// ("Administration" < "Content"). Re-sorting here (not fighting the utility's
// own filtering/grouping logic, just its final array order) is simpler than
// re-deriving groupNavItems from scratch.
const GROUP_ORDER = ["Content", "Administration"];
function sortGroups(groups: NavGroupType[]): NavGroupType[] {
  return [...groups].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.label);
    const bi = GROUP_ORDER.indexOf(b.label);
    return (ai === -1 ? GROUP_ORDER.length : ai) - (bi === -1 ? GROUP_ORDER.length : bi);
  });
}

// The interactive half of the custom Nav (components/AdminNav/index.tsx
// computes the server-filtered `groups` and passes them in as plain data).
// Reuses Payload's OWN responsive nav infrastructure -- the exact class
// names (`nav`, `nav__wrap`, `nav--nav-open`, etc.) DefaultNav's own
// NavWrapper applies, driven by the same shared useNav() context AppHeader's
// hamburger already writes to -- rather than building a second, parallel
// mobile show/hide mechanism. Confirmed by reading @payloadcms/next's actual
// NavWrapper/NavHamburger source before writing this, not assumed.
//
// A desktop icon-only collapsible rail (a custom hamburger toggle, separate
// from Payload's own mobile drawer control) was built, removed, and rebuilt
// with hover tooltips in this same spot before landing back here by explicit
// request -- it kept reading as more complexity than the admin needed.
// Payload's own AppHeader toggler (`.app-header__mobile-nav-toggler`) is the
// only show/hide control now, at every width, exactly as Payload ships it --
// nothing here suppresses or duplicates it, and the sidebar is always shown
// in full (never an icon-only rail) whenever it's visible at all.
type NavEntity = NavGroupType["entities"][number];
type NavRow = { kind: "item"; item: NavEntity } | { kind: "sub"; label: string; items: NavEntity[] };

// Entities that name a sub-group (see index.tsx) are gathered under one nested,
// collapsible row at the position of the first of them; the rest stay as they were.
function buildRows(entities: NavEntity[], subgroups: Record<string, string>): NavRow[] {
  const rows: NavRow[] = [];
  const subs = new Map<string, Extract<NavRow, { kind: "sub" }>>();
  for (const item of entities) {
    const label = subgroups[item.slug];
    if (!label) {
      rows.push({ kind: "item", item });
      continue;
    }
    let sub = subs.get(label);
    if (!sub) {
      sub = { kind: "sub", label, items: [] };
      subs.set(label, sub);
      rows.push(sub);
    }
    sub.items.push(item);
  }
  return rows;
}

// Remembered per browser: which groups the user opened or closed. Anything they
// haven't touched falls back to a default (the first group open, the group holding
// the current page open, the rest closed).
const NAV_PREFS_KEY = "polysite-admin-nav-open";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, transition: "transform 120ms", transform: open ? "rotate(90deg)" : "none" }}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function NavClient({
  groups,
  subgroups,
  pluginIcons,
  isSuperAdmin,
  userEmail,
  roleName,
}: {
  groups: NavGroupType[];
  subgroups: Record<string, string>;
  pluginIcons: Record<string, string[]>;
  isSuperAdmin: boolean;
  userEmail: string;
  roleName: string;
}) {
  const pathname = usePathname();
  const { config } = useConfig();
  const {
    routes: { admin: adminRoute },
  } = config;
  const { navOpen, navRef, setNavOpen } = useNav();

  // Payload's own NavProvider drives navOpen for the mobile/tablet drawer
  // (AppHeader's hamburger toggles the SAME shared state read here, so that
  // control still works) -- but relying on ITS OWN CSS classes
  // (nav--nav-open etc.) to decide DESKTOP visibility turned out fragile:
  // NavProvider's hydration effect only restores navOpen from a stored
  // preference above a max-width:1440px media query (confirmed by reading
  // @payloadcms/ui's Root provider source), so on any ordinary laptop
  // viewport the nav starts closed after every navigation with nothing to
  // reopen it, and a same-tick fix (even deferred a tick) raced against
  // that same effect and lost, unpredictably. Rather than keep fighting
  // that timing, visibility here is fully self-determined: isWideScreen is
  // tracked locally (a plain resize listener, no dependency on
  // @payloadcms/ui's useWindowInfo(), which separately threw a real
  // context-resolution error when tried here), and a wide screen ALWAYS
  // shows the sidebar in normal flow regardless of navOpen's value --
  // navOpen only matters below that width, where it drives a real overlay
  // drawer with a backdrop instead.
  // Names for the few controls Payload renders without one (components/A11y/adminA11y.ts).
  useEffect(() => installAdminA11y(), []);
  const [isWideScreen, setIsWideScreen] = useState(true);
  useEffect(() => {
    const check = () => setIsWideScreen(window.innerWidth > 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // isWideScreen alone only controls how THIS component renders itself --
  // a real bug caught building this: Payload's own content-area wrapper
  // (outside this component entirely, reading the same shared navOpen from
  // useNav()) still applies zero left margin when navOpen is false, so the
  // page content visually overlapped this sidebar even though the sidebar
  // itself was genuinely rendering at full width underneath. The shared
  // state has to actually flip too, not just this component's own opinion
  // of it. A same-tick and a same-frame (setTimeout 0) fix both raced
  // NavProvider's own hydration effect and lost unpredictably; 150ms is
  // comfortably past any of its async breakpoint-matching and imperceptible
  // during a real page load.
  //
  // hasAutoOpened is load-bearing, not decoration: a real bug shipped
  // without it -- depending on [isWideScreen, navOpen] alone meant this
  // effect re-armed every time navOpen changed, so a user closing the nav
  // via the hamburger set navOpen false, which this effect saw and flipped
  // straight back to true ~150ms later. Reported exactly as it looked: "on
  // click it closes, then as soon as I release it comes back open." This is
  // meant to correct navOpen exactly once, on initial hydration -- never
  // fight a click that happens any time after that.
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!isWideScreen || navOpen || hasAutoOpened.current) return;
    const timer = setTimeout(() => {
      hasAutoOpened.current = true;
      setNavOpen(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [isWideScreen, navOpen, setNavOpen]);

  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  // Read after mount, not during render, so the server and first client render agree.
  const [openPrefs, setOpenPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_PREFS_KEY) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage can only be read after mount
      if (saved && typeof saved === "object") setOpenPrefs(saved);
    } catch {
      /* blocked or corrupt storage: just use the defaults */
    }
  }, []);
  const setOpen = (key: string, open: boolean) =>
    setOpenPrefs((prev) => {
      const next = { ...prev, [key]: open };
      try {
        localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(next));
      } catch {
        /* the choice just won't be remembered */
      }
      return next;
    });

  const hrefOf = (item: NavEntity) =>
    item.type === EntityType.collection
      ? formatAdminURL({ adminRoute, path: `/collections/${item.slug}` })
      : formatAdminURL({ adminRoute, path: `/globals/${item.slug}` });
  const isActiveItem = (item: NavEntity) => {
    const href = hrefOf(item);
    return pathname.startsWith(href) && ["/", undefined].includes(pathname[href.length]);
  };

  const renderItem = (item: NavEntity, indent: number) => {
    const href = hrefOf(item);
    const isActive = isActiveItem(item);
    const ItemIcon = MODULE_ICONS[item.slug];
    const declared = pluginIcons[item.slug];
    return (
      <Link
        key={item.slug}
        href={href}
        prefetch={false}
        onMouseEnter={() => setHoveredHref(href)}
        onMouseLeave={() => setHoveredHref(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: `8px 12px 8px ${12 + indent}px`,
          borderRadius: 6,
          fontSize: 13,
          color: isActive ? ACCENT_ACTIVE_TEXT : "var(--theme-elevation-700)",
          background: isActive ? ACCENT_ACTIVE_BG : hoveredHref === href ? "var(--theme-elevation-100)" : "transparent",
        }}
      >
        {ItemIcon ? <ItemIcon /> : declared ? <PathIcon paths={declared} /> : <DashboardIcon />}
        {item.label}
      </Link>
    );
  };

  const dashboardHref = formatAdminURL({ adminRoute, path: "" });
  const isDashboardActive = pathname === dashboardHref || pathname === `${dashboardHref}/`;
  const sortedGroups = sortGroups(groups);

  const visuallyOpen = isWideScreen || navOpen;

  const wrapperClasses = ["nav", visuallyOpen && "nav--nav-open", "nav--nav-hydrated"].filter(Boolean).join(" ");

  const content = (
    <div className="nav__scroll" ref={navRef}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "var(--theme-elevation-0)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, minHeight: 60, padding: "0 18px", borderBottom: "1px solid var(--theme-elevation-150)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Mark size={24} style={{ color: "var(--theme-text)" }} />
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 17, fontWeight: 600, color: "var(--theme-text)" }}>
                Polysite
              </span>
            </div>
            {/* Mobile only: the drawer renders at full viewport width/height
                (Payload's own "open" styling, not something this component
                controls) with no visible backdrop left to tap and the
                hamburger that opened it hidden underneath the drawer itself
                -- there was genuinely no way to close it once open, a real
                dead end reported from an actual phone. A plain close button
                inside the drawer's own header is the direct fix, independent
                of whatever Payload's drawer sizing happens to be. */}
            {!isWideScreen && (
              <div
                onClick={() => setNavOpen(false)}
                role="button"
                aria-label="Close menu"
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--theme-elevation-500)",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </div>
            )}
          </div>
          {/* Payload's own AppHeader renders a second account avatar/link
              (`.app-header__account`, top-right of the page, outside this
              component entirely) in addition to the one in AccountMenu's
              sidebar footer below. Redundant everywhere, but only reported
              as a real problem on mobile, where both the drawer's own
              account row and this floating top-right avatar are visible at
              once in a much tighter layout -- hidden at the same ≤1024px
              breakpoint the mobile drawer itself uses, left alone on
              desktop. */}
          <style>{`@media (max-width: 1024px) { .app-header__account { display: none !important; } }`}</style>

          <SiteSwitcher isSuperAdmin={isSuperAdmin} />

          <div style={{ flexGrow: 1, overflowY: "auto", padding: "6px 10px" }}>
            <Link
              href={dashboardHref}
              prefetch={false}
              onMouseEnter={() => setHoveredHref(dashboardHref)}
              onMouseLeave={() => setHoveredHref(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 13,
                color: isDashboardActive ? ACCENT_ACTIVE_TEXT : "var(--theme-elevation-700)",
                background: isDashboardActive ? ACCENT_ACTIVE_BG : hoveredHref === dashboardHref ? "var(--theme-elevation-100)" : "transparent",
              }}
            >
              <DashboardIcon />
              Dashboard
            </Link>
            <div style={{ height: 1, background: "var(--theme-elevation-100)", margin: "8px 4px" }} />

            {sortedGroups.map((group, groupIndex) => {
              const groupKey = `g:${group.label}`;
              const holdsCurrentPage = group.entities.some(isActiveItem);
              const groupOpen = openPrefs[groupKey] ?? (groupIndex === 0 || holdsCurrentPage);
              const rows = buildRows(group.entities, subgroups);
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => setOpen(groupKey, !groupOpen)}
                    aria-expanded={groupOpen}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 10.5,
                      letterSpacing: "0.06em",
                      color: "var(--theme-elevation-600)",
                      textTransform: "uppercase",
                      padding: groupIndex === 0 ? "2px 12px 6px" : "14px 12px 6px",
                    }}
                  >
                    {group.label}
                    <Chevron open={groupOpen} />
                  </button>
                  {groupOpen &&
                    rows.map((row) => {
                      if (row.kind === "item") return renderItem(row.item, 0);
                      const subKey = `s:${group.label}/${row.label}`;
                      const subOpen = openPrefs[subKey] ?? row.items.some(isActiveItem);
                      return (
                        <div key={subKey}>
                          <button
                            type="button"
                            onClick={() => setOpen(subKey, !subOpen)}
                            aria-expanded={subOpen}
                            style={{
                              display: "flex",
                              width: "100%",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: "transparent",
                              border: 0,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 13,
                              color: "var(--theme-elevation-700)",
                              padding: "8px 12px",
                              borderRadius: 6,
                            }}
                          >
                            {row.label}
                            <Chevron open={subOpen} />
                          </button>
                          {subOpen && row.items.map((item) => renderItem(item, 16))}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>

          <AccountMenu userEmail={userEmail} roleName={roleName} />
        </div>
    </div>
  );

  if (isWideScreen) {
    return <aside className={wrapperClasses}>{content}</aside>;
  }

  // Narrow screens: visuallyOpen here just is navOpen (isWideScreen is
  // false), so this is the real overlay-drawer case -- Payload's own CSS
  // for nav--nav-open handles the slide-in/position, this just adds the
  // backdrop (which DefaultNav doesn't need since it's rendered inside the
  // same fixed-position system some other way) and wires it to close on
  // click, same setNavOpen the shared hamburger uses.
  return (
    <>
      {visuallyOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10, 10, 12, 0.5)", zIndex: 99 }} />
      )}
      {/* Payload's own `.nav` is already `position: sticky` (so z-index
          applies fine) but sets no explicit z-index (`auto`) -- any sibling
          WITH an explicit z-index, like the backdrop above, stacks above an
          `auto`-z-index element regardless of DOM order. That meant the
          backdrop sat on top of the sidebar itself, so every click meant for
          a nav link actually landed on the backdrop and closed the drawer
          instead -- confirmed via `elementFromPoint` over the sidebar
          returning the backdrop div, not the link underneath.
          `visuallyOpen ? 100 : undefined`, NOT an unconditional 100 -- this
          `<aside>` renders at full viewport size even while CLOSED (Payload
          makes it invisible via `opacity: 0`, not by shrinking or removing
          it), and it previously lost the paint/hit-test order to the
          AppHeader's own controls (hamburger, "Create new", search) purely
          by DOM order since both sat at z-index:auto. An unconditional 100
          made this invisible-but-full-screen closed state win that order
          unconditionally too, silently blocking every click on the entire
          page -- a real regression caught by testing the closed state, not
          just the open one. Only elevating it while actually open keeps the
          closed state exactly as unobtrusive as Payload's own default. */}
      <aside className={wrapperClasses} style={{ zIndex: visuallyOpen ? 100 : undefined }}>{content}</aside>
    </>
  );
}
