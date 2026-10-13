"use client";

import { isValidElement, useState } from "react";
import type { ReactNode } from "react";
import { useTenantSelection } from "@payloadcms/plugin-multi-tenant/client";
import type { OptionObject } from "payload";

import { BuildingIcon, ChevronDownIcon, CheckIcon } from "./icons";

// Payload's Option.label is typed broadly (string | localized-label record |
// JSX element | a translate-aware label function) to cover every possible
// field config across the whole system. Sites' own tenant label (its `name`
// field) is always a plain string in this project -- no i18n or custom
// labelFunction configured on the multi-tenant plugin -- so only the string
// branch is ever hit for real; the rest are defensive fallbacks, not
// expected to render.
function renderOptionLabel(label: OptionObject["label"]): ReactNode {
  if (typeof label === "string") return label;
  if (isValidElement(label)) return label;
  if (typeof label === "function") return null;
  return Object.values(label)[0] ?? null;
}

// Drives Payload's REAL tenant-selection state (useTenantSelection, exported
// by the multi-tenant plugin) -- not a decorative reskin. Picking a site
// here actually re-scopes list views the same way the plugin's own
// TenantSelector would; this just controls where/how it's drawn. Only ever
// rendered for a Super Admin (gated by the parent, NavClient.tsx) -- "no
// traces of it" for Site Admin/Site User, the user's own explicit
// requirement from the design discussion.
//
// "All sites" clears the selection (the plugin's own setTenant({ id: undefined }),
// which deletes the tenant cookie), so lists show everything the user can open.
// The plugin refuses to clear for someone with a single site, so that entry, and
// the whole switcher for a non-Super Admin, only appears with more than one site.
export function SiteSwitcher({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { options, selectedTenantID, setTenant } = useTenantSelection();
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.value === selectedTenantID);
  const canClear = options.length > 1;

  if (!isSuperAdmin && !canClear) return null;

  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--theme-elevation-150)", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, position: "relative" }} className="polysite-site-label">
        <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: "var(--theme-elevation-600)", textTransform: "uppercase" }}>
          Site
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--theme-elevation-400)" strokeWidth={2} style={{ cursor: "help" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="11.5" />
          <circle cx="12" cy="8" r="0.5" fill="var(--theme-elevation-400)" stroke="none" />
        </svg>
        <div
          className="polysite-site-tooltip"
          style={{
            position: "absolute",
            top: 20,
            left: 0,
            width: 210,
            fontSize: 11,
            lineHeight: 1.45,
            color: "var(--theme-elevation-600)",
            background: "var(--theme-input-bg)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 6,
            padding: "8px 10px",
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 0.12s",
            zIndex: 30,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
          }}
        >
          Pick a site to work on just that one, or All sites to see everything you can open. People with a single site do not see this.
        </div>
        <style>{`.polysite-site-label:hover .polysite-site-tooltip { opacity: 1; }`}</style>
      </div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 10px",
          border: "1px solid var(--theme-elevation-150)",
          borderRadius: "var(--style-radius-m)",
          background: "var(--theme-elevation-50)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <BuildingIcon color="var(--theme-elevation-500)" />
          <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {current ? renderOptionLabel(current.label) : canClear ? "All sites" : "Select a site"}
          </span>
        </div>
        <ChevronDownIcon color="var(--theme-elevation-400)" />
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "var(--theme-input-bg)",
              border: "1px solid var(--theme-elevation-150)",
              borderRadius: "var(--style-radius-m)",
              padding: 6,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
              zIndex: 50,
            }}
          >
            <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: "var(--theme-elevation-600)", textTransform: "uppercase", padding: "6px 8px 4px" }}>
              Switch site
            </div>
            {canClear && (
              <div
                onClick={() => {
                  setTenant({ id: undefined, refresh: true });
                  setOpen(false);
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 8, borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BuildingIcon color="var(--theme-elevation-500)" width={14} height={14} />
                  All sites
                </div>
                {selectedTenantID === undefined && <CheckIcon color="#7c7ce0" />}
              </div>
            )}
            {options.map((site) => (
              <div
                key={site.value}
                onClick={() => {
                  setTenant({ id: site.value, refresh: true });
                  setOpen(false);
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 8, borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BuildingIcon color="var(--theme-elevation-500)" width={14} height={14} />
                  {renderOptionLabel(site.label)}
                </div>
                {site.value === selectedTenantID && <CheckIcon color="#7c7ce0" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
