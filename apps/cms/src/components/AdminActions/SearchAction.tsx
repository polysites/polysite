"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";

import { SearchIcon, PagesIcon, MediaIcon, UsersIcon } from "../AdminNav/icons";
import { LoadingMark } from "../Brand/LoadingMark";

type Result = { id: string | number; label: string; collection: string; icon: typeof PagesIcon };

// Wired into admin.components.actions (payload.config.ts), same top-bar
// slot as CreateAction. No built-in Payload command palette exists
// (confirmed by grepping the installed package for "command"/"kbar"/etc
// before writing this) -- this is genuinely new, real search, not a
// decorative popup: on-type REST calls against whichever collections the
// signed-in session can actually read, same credentials:"include" pattern
// already established by CloneToSiteButton.tsx.
export function SearchAction() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { config } = useConfig();
  const {
    serverURL,
    routes: { api, admin: adminBase },
  } = config;
  const apiBase = `${serverURL}${api}`;

  // Closing resets query/results directly, at the point `open` actually
  // changes, instead of syncing them from an effect -- react-hooks'
  // set-state-in-effect rule flags a synchronous setState call in an effect
  // body as a sign the state is better computed/reset at the source, and
  // every close path here (Escape, backdrop click, picking a result) already
  // goes through this one function.
  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Doesn't reset `results` for an empty query -- the render below only
  // ever shows them when `query.trim()` is truthy anyway (visibleResults),
  // so there's nothing to sync here, just a fetch to skip.
  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all([
        fetch(`${apiBase}/pages?where[title][like]=${encodeURIComponent(query)}&limit=5&depth=0`, { credentials: "include", signal: controller.signal })
          .then((r) => (r.ok ? r.json() : { docs: [] }))
          .then((d) => (d.docs ?? []).map((doc: { id: string | number; title?: string }) => ({ id: doc.id, label: doc.title ?? "Untitled", collection: "pages", icon: PagesIcon }))),
        fetch(`${apiBase}/media?where[alt][like]=${encodeURIComponent(query)}&limit=5&depth=0`, { credentials: "include", signal: controller.signal })
          .then((r) => (r.ok ? r.json() : { docs: [] }))
          .then((d) => (d.docs ?? []).map((doc: { id: string | number; alt?: string }) => ({ id: doc.id, label: doc.alt ?? "Untitled", collection: "media", icon: MediaIcon }))),
        fetch(`${apiBase}/users?where[email][like]=${encodeURIComponent(query)}&limit=5&depth=0`, { credentials: "include", signal: controller.signal })
          .then((r) => (r.ok ? r.json() : { docs: [] }))
          .then((d) => (d.docs ?? []).map((doc: { id: string | number; email?: string }) => ({ id: doc.id, label: doc.email ?? "Untitled", collection: "users", icon: UsersIcon }))),
      ])
        .then((groups) => setResults(groups.flat()))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, apiBase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Stale results from a previous query shouldn't render once the input's
  // been cleared back to empty, even though `results` itself isn't reset
  // until the search panel actually closes (see `close` above).
  const visibleResults = query.trim() ? results : [];

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--style-radius-m)",
          border: "1px solid var(--theme-elevation-150)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--theme-elevation-500)",
          cursor: "pointer",
        }}
      >
        <SearchIcon />
      </div>
      {open && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, background: "rgba(10, 10, 12, 0.5)", display: "flex", justifyContent: "center", paddingTop: 96, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 560, maxWidth: "calc(100vw - 32px)", background: "var(--theme-input-bg)", border: "1px solid var(--theme-elevation-150)", borderRadius: "var(--style-radius-l)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)", overflow: "hidden" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--theme-elevation-150)" }}>
              <SearchIcon color="var(--theme-elevation-500)" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, media, users…"
                style={{ flexGrow: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--theme-text)" }}
              />
              {loading ? (
                <LoadingMark size={16} color="var(--theme-elevation-500)" />
              ) : (
                <span style={{ fontSize: 11, color: "var(--theme-elevation-500)", border: "1px solid var(--theme-elevation-150)", borderRadius: 4, padding: "2px 6px" }}>Esc</span>
              )}
            </div>
            <div style={{ padding: 6, maxHeight: 360, overflowY: "auto" }}>
              {!loading && query.trim() && visibleResults.length === 0 && (
                <div style={{ padding: "16px 10px", fontSize: 13, color: "var(--theme-elevation-500)" }}>No results for &ldquo;{query}&rdquo;</div>
              )}
              {visibleResults.map((r) => {
                const RIcon = r.icon;
                return (
                  <Link
                    key={`${r.collection}-${r.id}`}
                    href={formatAdminURL({ adminRoute: adminBase, path: `/collections/${r.collection}/${r.id}` })}
                    prefetch={false}
                    onClick={close}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, fontSize: 13 }}
                  >
                    <RIcon />
                    {r.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
