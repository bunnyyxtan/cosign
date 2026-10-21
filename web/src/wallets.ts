import type { Eip1193 } from "./chain";

/** A wallet the browser actually exposes. Nothing here is listed unless its provider exists. */
export type Wallet = { id: string; name: string; icon?: string; provider: Eip1193; legacy?: true };

/** Wallets Cosign recommends, in order. Matched against what the browser announces; never assumed present. */
export const KNOWN = [
  { id: "io.rabby", name: "Rabby Wallet", match: /rabby/i, install: "https://rabby.io/" },
  { id: "com.okex.wallet", name: "OKX Wallet", match: /okx|okex/i, install: "https://www.okx.com/web3" },
] as const;
export type Known = (typeof KNOWN)[number];

type Announce = CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 }>;

const announced = new Map<string, Wallet>();
const subs = new Set<() => void>();
let list: Wallet[] = [];

function rebuild() {
  const next = [...announced.values()];
  // A wallet that predates EIP-6963 shows up only as window.ethereum; list it only when nothing announced itself,
  // so a wallet that does both is not listed twice.
  const legacy = window.ethereum as (Eip1193 & { isRabby?: boolean; isOkxWallet?: boolean }) | undefined;
  if (!next.length && legacy) {
    const id = legacy.isRabby ? "io.rabby" : legacy.isOkxWallet ? "com.okex.wallet" : "injected";
    next.push({ id, name: KNOWN.find((k) => k.id === id)?.name ?? "Browser wallet", provider: legacy, legacy: true });
  }
  list = next;
  subs.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e) => {
    const { info, provider } = (e as Announce).detail;
    // EIP-6963 icons are data URIs; anything else would be a remote fetch the CSP blocks, so it is dropped.
    const icon = /^data:image\//.test(info.icon) ? info.icon : undefined;
    announced.set(info.rdns || info.uuid, { id: info.rdns || info.uuid, name: info.name, icon, provider });
    rebuild();
  });
  window.addEventListener("ethereum#initialized", rebuild);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  rebuild();
  setTimeout(rebuild, 3000); // late legacy injection without the event
}

export const wallets = () => list;
export function onWallets(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export const knownFor = (w: Wallet) => KNOWN.find((k) => k.id === w.id || k.match.test(w.name));

// Remembers which wallet was picked (an id, never an address) so a reload restores through the same provider.
const KEY = "cosign:wallet";
export function savedWallet() { try { return localStorage.getItem(KEY); } catch { return null; } }
export function saveWallet(id: string) { try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ } }
