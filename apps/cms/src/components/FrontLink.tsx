"use client";

import { useConfig, useFormFields } from "@payloadcms/ui";
import { useEffect, useState } from "react";

import { buildPageUrl } from "../utils/pageUrl";

// The public URL of a Page: its Site's domain + its slug. Shown as a link in
// the Pages list (Cell) and under the slug in the editor (Field). The scheme
// follows the admin's own, which matches the site's in every environment
// here (http locally, https in production).
//
// The list hands the Cell `site` as a bare id, not a populated object, so the
// domain is looked up -- once per site per page load, shared by every row.
const domainCache = new Map<string, Promise<string | null>>();

function fetchDomain(api: string, siteId: string): Promise<string | null> {
  let hit = domainCache.get(siteId);
  if (!hit) {
    hit = fetch(`${api}/sites/${siteId}?depth=0`, { credentials: "include" })
      .then((res) => res.json())
      .then((site) => (typeof site?.domain === "string" ? site.domain : null))
      .catch(() => null);
    domainCache.set(siteId, hit);
  }
  return hit;
}

function useSiteDomain(siteRef: unknown): string | null {
  const { config } = useConfig();
  const populated = siteRef && typeof siteRef === "object" ? (siteRef as { id?: unknown; domain?: unknown }) : null;
  const siteId = populated ? populated.id : siteRef;
  const inline = typeof populated?.domain === "string" ? populated.domain : null;
  const [fetched, setFetched] = useState<{ id: string; domain: string | null } | null>(null);
  const api = `${config.serverURL}${config.routes.api}`;

  useEffect(() => {
    if (inline || siteId === undefined || siteId === null || siteId === "") return;
    let cancelled = false;
    fetchDomain(api, String(siteId)).then((domain) => !cancelled && setFetched({ id: String(siteId), domain }));
    return () => {
      cancelled = true;
    };
  }, [api, siteId, inline]);

  if (inline) return inline;
  return siteId !== undefined && siteId !== null && fetched?.id === String(siteId) ? fetched.domain : null;
}

const linkStyle: React.CSSProperties = { color: "inherit", textDecoration: "underline", wordBreak: "break-all" };
const scheme = () => (typeof window !== "undefined" ? window.location.protocol.replace(":", "") : "https");

function Link({ domain, slug }: { domain: string; slug: unknown }) {
  const href = buildPageUrl(domain, slug, scheme());
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
      {href.replace(/^https?:\/\//, "")}
    </a>
  );
}

export function FrontLinkCell({ rowData }: { rowData?: { slug?: unknown; site?: unknown } }) {
  const domain = useSiteDomain(rowData?.site);
  return domain ? <Link domain={domain} slug={rowData?.slug} /> : <span>—</span>;
}

export function FrontLinkField() {
  const slug = useFormFields(([fields]) => fields.slug?.value);
  const site = useFormFields(([fields]) => fields.site?.value);
  const domain = useSiteDomain(site);
  return (
    <div className="field-type" style={{ marginBottom: "var(--base)" }}>
      <label className="field-label">Front-end Link</label>
      {domain ? <Link domain={domain} slug={slug} /> : <span>—</span>}
    </div>
  );
}
