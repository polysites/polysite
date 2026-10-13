"use client";

import { toast, useAuth, useConfig } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CloneToSiteModal } from "./CloneToSiteModal";

// The three-dot menu on each row of the Pages list (a `ui` field's Cell --
// Payload has no built-in per-row actions), so a page can be opened,
// duplicated, cloned to another site or deleted straight from the list
// instead of opening it first. Duplicate calls the same endpoint Payload's own
// edit-view button does. Menu entries are only hidden as a courtesy
// (useAuth permissions); the API enforces access regardless.
type CellProps = { rowData?: { id?: string | number }; collectionSlug?: string };

const MENU_WIDTH = 200;

export function PageRowActions({ rowData, collectionSlug = "pages" }: CellProps) {
  const id = rowData?.id;
  const { config } = useConfig();
  const { permissions } = useAuth();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = () => close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [pos]);

  if (id === undefined || id === null) return null;

  const perms = (permissions?.collections as Record<string, Record<string, unknown>> | undefined)?.[collectionSlug];
  const can = (op: string) => (perms ? Boolean(perms[op]) : true);
  const api = `${config.serverURL}${config.routes.api}`;
  const editHref = `${config.routes.admin}/collections/${collectionSlug}/${id}`;

  const toggle = () => {
    if (pos) return close();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)) });
  };

  const duplicate = async () => {
    close();
    setBusy(true);
    try {
      const res = await fetch(`${api}/${collectionSlug}/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.errors?.[0]?.message || data?.message || "Duplicate failed.");
        return;
      }
      toast.success("Duplicated as a draft.");
      router.push(`${config.routes.admin}/collections/${collectionSlug}/${data.doc.id}`);
    } catch {
      toast.error("Duplicate failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    close();
    if (!window.confirm("Delete this page? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`${api}/${collectionSlug}/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.errors?.[0]?.message || data?.message || "Delete failed.");
        return;
      }
      toast.success("Page deleted.");
      router.refresh();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    padding: "8px 16px",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
    textDecoration: "none",
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        disabled={busy}
        onClick={toggle}
        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 20, lineHeight: 1, padding: "2px 8px" }}
      >
        ⋮
      </button>
      {pos &&
        createPortal(
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={close} />
            <div
              role="menu"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: MENU_WIDTH,
                zIndex: 9999,
                background: "var(--theme-elevation-0, #fff)",
                color: "var(--theme-elevation-1000, #000)",
                border: "1px solid var(--theme-elevation-150, #ddd)",
                borderRadius: 4,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                padding: "4px 0",
              }}
            >
              <a role="menuitem" href={editHref} style={itemStyle} onClick={close}>
                Edit
              </a>
              {can("create") && (
                <button role="menuitem" type="button" style={itemStyle} onClick={duplicate}>
                  Duplicate
                </button>
              )}
              <button
                role="menuitem"
                type="button"
                style={itemStyle}
                onClick={() => {
                  close();
                  setCloneOpen(true);
                }}
              >
                Clone to another site
              </button>
              {can("delete") && (
                <button role="menuitem" type="button" style={{ ...itemStyle, color: "var(--theme-error-500, #d33)" }} onClick={remove}>
                  Delete
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      {cloneOpen && <CloneToSiteModal id={id} onClose={() => setCloneOpen(false)} />}
    </>
  );
}
