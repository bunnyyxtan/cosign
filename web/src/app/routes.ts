// Application URLs. Markets are named by fixed slugs that map to the deployment's vault addresses; a URL never
// supplies an address, so nothing in it decides which contract the app talks to. Checked by scripts/check-routes.ts.

export const SLUGS = ["bold", "steady"] as const;
export type Slug = (typeof SLUGS)[number];
export const isSlug = (s: string | undefined): s is Slug => !!s && (SLUGS as readonly string[]).includes(s);

export type Route =
  | { page: "markets" }
  | { page: "market"; slug: Slug; tab: "lend" | "borrow" }
  | { page: "cosign"; slug?: Slug }
  | { page: "rewards" }
  | { page: "portfolio" }
  | { page: "evidence" }
  | { page: "notfound"; what: "market" | "page" };

export const APP = "/app";

/** Reads a pathname under /app. `/app` and `/app/` are the app's front door, shown as Markets. */
export function parsePath(pathname: string): Route {
  if (pathname !== APP && !pathname.startsWith(APP + "/")) return { page: "notfound", what: "page" };
  const parts = pathname.slice(APP.length).split("/").filter(Boolean).map((p) => p.toLowerCase());
  const [a, b, c, ...rest] = parts;
  if (rest.length) return { page: "notfound", what: "page" };
  if (!a) return { page: "markets" };
  if (a === "markets") {
    if (!b) return c ? { page: "notfound", what: "page" } : { page: "markets" };
    if (!isSlug(b)) return { page: "notfound", what: "market" };
    if (!c) return { page: "market", slug: b, tab: "lend" };
    return c === "borrow" ? { page: "market", slug: b, tab: "borrow" } : { page: "notfound", what: "page" };
  }
  if (a === "co-sign") {
    if (c) return { page: "notfound", what: "page" };
    if (!b) return { page: "cosign" };
    return isSlug(b) ? { page: "cosign", slug: b } : { page: "notfound", what: "market" };
  }
  if (!b && (a === "rewards" || a === "portfolio" || a === "evidence")) return { page: a };
  return { page: "notfound", what: "page" };
}

/** The canonical path for a route. */
export function pathOf(r: Route): string {
  switch (r.page) {
    case "markets": return `${APP}/markets`;
    case "market": return `${APP}/markets/${r.slug}${r.tab === "borrow" ? "/borrow" : ""}`;
    case "cosign": return `${APP}/co-sign${r.slug ? `/${r.slug}` : ""}`;
    case "rewards": case "portfolio": case "evidence": return `${APP}/${r.page}`;
    case "notfound": return `${APP}/markets`;
  }
}

export const href = {
  markets: () => pathOf({ page: "markets" }),
  market: (slug: Slug, tab: "lend" | "borrow" = "lend") => pathOf({ page: "market", slug, tab }),
  cosign: (slug?: Slug) => pathOf({ page: "cosign", slug }),
  rewards: () => pathOf({ page: "rewards" }),
  portfolio: () => pathOf({ page: "portfolio" }),
  evidence: () => pathOf({ page: "evidence" }),
};

/**
 * Old hash links (#/markets, #/market/0x…[/borrow], #/cosign[/0x…], #/positions, #/portfolio, #/rewards, #/evidence)
 * mapped to the canonical path. `slugOf` is the deployment's own vault-to-slug table; an address it doesn't know
 * keeps the intent ("a market") and lands on the unknown-market page. Null when the hash is not an old route.
 */
export function legacyPath(hash: string, slugOf: (vault: string) => Slug | undefined): string | null {
  if (!/^#\/?[a-z]/i.test(hash)) return null;
  const [p, a, b] = hash.replace(/^#\/?/, "").split(/[/?]/);
  const page = p.toLowerCase();
  const slug = a ? slugOf(a) : undefined;
  if (page === "market") {
    if (!a) return href.markets();
    return slug ? href.market(slug, b?.toLowerCase() === "borrow" ? "borrow" : "lend") : `${APP}/markets/unknown-market`;
  }
  if (page === "cosign") return a ? (slug ? href.cosign(slug) : `${APP}/co-sign/unknown-market`) : href.cosign();
  if (page === "positions" || page === "portfolio") return href.portfolio();
  if (page === "markets") return href.markets();
  if (page === "rewards") return href.rewards();
  if (page === "evidence") return href.evidence();
  return null;
}

/** Keeps the address bar in step with a choice made on the page (a tab, a market) without a navigation, so a copied
 *  link or a refresh opens the same view. */
export function keepUrl(path: string) {
  if (window.location.pathname !== path) window.history.replaceState(null, "", path);
}

/** Slug lookup from the deployment's addresses (case-insensitive, exact match only). */
export function slugTable(vaults: Partial<Record<Slug, string>>) {
  const t = new Map<string, Slug>();
  for (const s of SLUGS) { const v = vaults[s]; if (v && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/.test(v)) t.set(v.toLowerCase(), s); }
  return (vault: string) => t.get(vault.toLowerCase());
}
