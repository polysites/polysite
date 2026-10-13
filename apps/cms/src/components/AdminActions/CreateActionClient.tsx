"use client";

import { useState } from "react";
import { Link, useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";

import { PlusIcon, ChevronDownIcon } from "../AdminNav/icons";
import { MODULE_ICONS } from "../AdminNav/icons";

export function CreateActionClient({ items }: { items: { slug: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { config } = useConfig();
  const {
    routes: { admin: adminRoute },
  } = config;

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 14px",
          height: 34,
          borderRadius: "var(--style-radius-m)",
          background: "#7c7ce0",
          color: "#101014",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <PlusIcon />
        Create new
        <ChevronDownIcon />
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 200,
              background: "var(--theme-input-bg)",
              border: "1px solid var(--theme-elevation-150)",
              borderRadius: "var(--style-radius-m)",
              padding: 6,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
              zIndex: 50,
            }}
          >
            {items.map((item) => {
              const ItemIcon = MODULE_ICONS[item.slug];
              return (
                <Link
                  key={item.slug}
                  href={formatAdminURL({ adminRoute, path: `/collections/${item.slug}/create` })}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, fontSize: 13 }}
                >
                  {ItemIcon && <ItemIcon />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
