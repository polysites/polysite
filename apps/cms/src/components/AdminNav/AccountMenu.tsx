"use client";

import { useState } from "react";
import { Link, useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";

import { ChevronUpIcon, SettingsIcon, LogOutIconCustom } from "./icons";

// Logout stays nested behind this toggle by explicit, twice-reaffirmed user
// decision (not the initial recommendation -- see the design discussion).
// The logout link itself is the exact mechanism LogoutButton.tsx used
// (formatAdminURL to the real logout route), just inlined here since
// admin.components.logout.Button stops rendering once admin.components.Nav
// is overridden -- see index.tsx's comment for why.
export function AccountMenu({ userEmail, roleName }: { userEmail: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const { config } = useConfig();
  const {
    admin: { routes: adminRoutes },
    routes: { admin: adminRoute },
  } = config;
  const accountHref = formatAdminURL({ adminRoute, path: adminRoutes.account });
  const logoutHref = formatAdminURL({ adminRoute, path: adminRoutes.logout });

  const initials = userEmail
    .split("@")[0]
    ?.split(/[._-]/)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

  return (
    <div style={{ borderTop: "1px solid var(--theme-elevation-150)", padding: 8, position: "relative" }}>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              bottom: "calc(100% + 4px)",
              border: "1px solid var(--theme-elevation-150)",
              borderRadius: "var(--style-radius-m)",
              background: "var(--theme-input-bg)",
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
              zIndex: 50,
            }}
          >
            <Link href={accountHref} className="account-menu-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", fontSize: 13 }}>
              <SettingsIcon color="var(--theme-elevation-500)" />
              Account settings
            </Link>
            <Link href={logoutHref} prefetch={false} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", fontSize: 13, color: "var(--theme-error-500)" }}>
              <LogOutIconCustom color="var(--theme-error-500)" />
              Log out
            </Link>
          </div>
        </>
      )}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 8,
          borderRadius: "var(--style-radius-m)",
          background: "var(--theme-elevation-50)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              minWidth: 28,
              borderRadius: "50%",
              background: "rgba(124, 124, 224, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--polysite-nav-avatar-text)",
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--theme-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</div>
            {roleName && <div style={{ fontSize: 11, color: "var(--polysite-nav-muted-accent)" }}>{roleName}</div>}
          </div>
        </div>
        <ChevronUpIcon color="var(--theme-elevation-400)" />
      </div>
    </div>
  );
}
