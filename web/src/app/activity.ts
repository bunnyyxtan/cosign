// Transaction notices and this session's activity, as pure functions so their timing rules can be checked
// without a browser (scripts/check-activity.ts). Nothing here is stored outside the page's memory.
import type { Hex } from "viem";

/**
 * signing  the wallet is asking the user to sign
 * pending  sent; waiting for a receipt
 * syncing  confirmed onchain; figures are being re-read at or after its block
 * done     confirmed and figures re-read
 * approved an approval confirmed; the action it unlocks is a separate, deliberate step
 * unsynced confirmed, but figures could not be re-read yet (never shown as a failure)
 * unknown  no receipt after the wait; it may still land (never shown as a failure)
 * rejected the user declined in the wallet; nothing was sent
 * failed   reverted onchain, or the wallet/RPC refused it
 */
export type TxState = "signing" | "pending" | "syncing" | "done" | "approved" | "unsynced" | "unknown" | "rejected" | "failed";

/** The action an approval unlocks. The originating form offers it too, so this toast is never the only way to it. */
export type Next = { ready: string; label: string; run: () => void };

export type TxItem = {
  id: number;
  /** The account that sent it; a different connected account never sees it. */
  account: string;
  label: string;
  state: TxState;
  text: string;
  tx?: Hex;
  block?: bigint;
  /** Technical reason, shown only on request. */
  detail?: string;
  next?: Next;
  at: number;
  /** Whether it is on screen as a toast. Hidden items stay in the activity list. */
  shown: boolean;
  /** When a resolved toast hides itself; undefined while it must stay. */
  hideAt?: number;
  /** The user closed an unknown-outcome notice after checking the explorer: it no longer pauses new transactions. */
  acked?: boolean;
  /** Recovered after a reload from the saved hash, not sent in this page. */
  restored?: boolean;
};

/** Unresolved: on screen until resolved, never dismissable, never auto-hidden. */
export const isOpen = (s: TxState) => s === "signing" || s === "pending" || s === "syncing";

/** How long a resolved toast stays. Undefined means until the user dismisses it. */
export function lifetime(s: TxState): number | undefined {
  if (s === "done" || s === "approved") return 6000;
  if (s === "rejected") return 8000;
  return undefined; // failed, unsynced, unknown: the user has to see these
}

export const tone = (s: TxState) =>
  isOpen(s) || s === "unknown" || s === "unsynced" ? "pending" : s === "failed" ? "bad" : s === "rejected" ? "quiet" : "ok";

const MAX = 30;

export function add(list: TxItem[], item: Omit<TxItem, "shown" | "hideAt">): TxItem[] {
  return [{ ...item, shown: true }, ...list].slice(0, MAX);
}

/** Moves an item to a new state. Entering a resolved state starts its timer; reaching it again re-shows it. */
export function update(list: TxItem[], id: number, p: Partial<Omit<TxItem, "id" | "shown" | "hideAt">>, now: number): TxItem[] {
  return list.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...p };
    if (p.state && p.state !== t.state) {
      const life = lifetime(p.state);
      next.shown = true;
      next.hideAt = isOpen(p.state) || life === undefined ? undefined : now + life;
    }
    return next;
  });
}

/** The user closed a toast. Unresolved transactions cannot be closed. */
export const dismiss = (list: TxItem[], id: number) =>
  list.map((t) => (t.id === id && !isOpen(t.state) ? { ...t, shown: false, hideAt: undefined, acked: t.acked || t.state === "unknown" } : t));

/** Hides toasts whose time is up. While `held` (pointer or focus on the toasts) nothing hides, and resolved toasts
 *  get at least `grace` ms after the hold ends. */
export function sweep(list: TxItem[], now: number, held = false, grace = 2000): TxItem[] {
  let changed = false;
  const out = list.map((t) => {
    if (!t.shown || t.hideAt === undefined) return t;
    if (held) {
      if (t.hideAt < now + grace) { changed = true; return { ...t, hideAt: now + grace }; }
      return t;
    }
    if (t.hideAt <= now) { changed = true; return { ...t, shown: false, hideAt: undefined }; }
    return t;
  });
  return changed ? out : list;
}

/** What the current account may see. */
export const mine = (list: TxItem[], account: string | null) => (account ? list.filter((t) => t.account.toLowerCase() === account.toLowerCase()) : []);
export const toasts = (list: TxItem[], account: string | null) => mine(list, account).filter((t) => t.shown);
export const inFlight = (list: TxItem[], account: string | null) => mine(list, account).filter((t) => isOpen(t.state)).length;

/** Plain-language reasons for contract errors a user can hit. */
export const REASONS: Record<string, string> = {
  CapacityExceeded: "There isn't that much room to lend. Room opens as co-signers add cover.",
  Undercovered: "That withdrawal would leave lenders with less than the minimum cover.",
  NotReady: "Your withdrawal notice period has not ended yet.",
  RequestExpired: "Your withdrawal window closed. Request again.",
  RequestVoid: "Your request was cancelled because this market's cover was wiped out.",
  NoRequest: "Request a withdrawal first.",
  InsufficientShares: "You don't hold that much here.",
  VotesActive: "Remove your votes on this market before withdrawing all of your cover.",
  NoCover: "Post cover on a market before voting for it.",
  AlreadyVoted: "This veBTC position already voted this epoch.",
  NotApproved: "This wallet doesn't own that veBTC position.",
  NoPower: "This veBTC position has no voting power.",
  ZeroAmount: "Enter a larger amount.",
  EpochNotOver: "That epoch has not ended yet. It can be distributed once it is over.",
  AlreadyDistributed: "That epoch was already distributed.",
};

type Err = { shortMessage?: string; message?: string; code?: number; cause?: unknown; data?: { errorName?: string } };

/** viem wraps wallet errors several levels deep; read codes and messages from the whole chain. */
function chain(e: unknown) {
  const out: Err[] = [];
  for (let x = e as Err | undefined, i = 0; x && typeof x === "object" && i < 8; x = x.cause as Err | undefined, i++) out.push(x);
  return out;
}

/** Turns a wallet or RPC error into a short message. Raw RPC text is kept as an optional detail, never the headline. */
export function explain(e: unknown): { state: "rejected" | "failed"; text: string; detail?: string } {
  const all = chain(e);
  const codes = all.map((x) => x.code);
  const inner = all.slice(1).map((x) => x.message ?? "").join(" ");
  const every = all.map((x) => x.message ?? "").join(" ");
  const raw = [...new Set(all.map((x) => (x.shortMessage ?? x.message ?? "").split(/\r?\n/)[0].trim()).filter(Boolean))].join(" · ").slice(0, 240);
  if (codes.includes(4001) || /user rejected|user denied|rejected the request|declined/i.test(every))
    return { state: "rejected", text: "You declined in your wallet. Nothing was sent." };
  const name = all.map((x) => x.data?.errorName).find(Boolean) ?? Object.keys(REASONS).find((k) => every.includes(k));
  if (name && REASONS[name]) return { state: "failed", text: REASONS[name], detail: raw || undefined };
  if (/insufficient collateral/i.test(every)) return { state: "failed", text: "That would leave your loan under-collateralised. Repay first, or borrow less.", detail: raw };
  if (/insufficient liquidity/i.test(every)) return { state: "failed", text: "Not enough unborrowed MUSD in this market right now. Try a smaller amount.", detail: raw };
  if (/insufficient funds|exceeds balance/i.test(every)) return { state: "failed", text: "Not enough balance for this amount plus the network fee (BTC).", detail: raw };
  if (all.length === 1 && /Mezo testnet/i.test(raw) && raw.length < 140) return { state: "failed", text: raw }; // our own network messages are already plain
  if (/execution reverted/i.test(every)) return { state: "failed", text: "Mezo testnet would reject this transaction, so nothing was sent. Check the amount and try again.", detail: raw };
  if (codes.includes(-32603) || /internal json-rpc|internal error/i.test(inner)) return { state: "failed", text: "The wallet could not complete this request. Nothing was sent.", detail: raw || undefined };
  if (/fetch failed|failed to fetch|network|timeout|HTTP request failed/i.test(every)) return { state: "failed", text: "Mezo testnet did not respond. Nothing was sent; try again in a moment.", detail: raw };
  return { state: "failed", text: "The wallet could not complete this request. Nothing was sent.", detail: raw || undefined };
}

// ---------------------------------------------------------------- recovery across reloads
// Only what is needed to look a transaction up again: its hash (public onchain), a label, the chain, the time it was
// sent, and a keccak tag of the sending account so another account never sees it. No address or amount is stored.

export type Saved = { tx: Hex; label: string; chain: number; who: string; at: number };
export const SAVE_KEY = "cosign:unresolved:v1";
/** How long an unresolved hash is kept and re-checked. */
export const KEEP_MS = 24 * 60 * 60 * 1000;

/** Transactions with a hash whose outcome isn't known yet. Confirmed-but-unread ones are settled onchain, so not kept. */
export const unresolved = (t: TxItem) => !!t.tx && (t.state === "pending" || t.state === "unknown");

/** Merges this account's unresolved items into what is saved for others, dropping anything resolved or expired. */
export function toSave(prev: Saved[], list: TxItem[], who: string, chain: number, now: number, tag: (a: string) => string): Saved[] {
  const keep = prev.filter((x) => !(x.who === who && x.chain === chain) && now - x.at < KEEP_MS);
  const mineNow = list
    .filter((t) => tag(t.account) === who && unresolved(t) && now - t.at < KEEP_MS)
    .map((t) => ({ tx: t.tx!, label: t.label, chain, who, at: t.at }));
  return [...keep, ...mineNow];
}

/** Parses saved data defensively; anything malformed is ignored. */
export function parseSaved(raw: string | null): Saved[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && /^0x[0-9a-fA-F]{64}$/.test(x.tx) && typeof x.label === "string" && Number.isInteger(x.chain) && typeof x.who === "string" && Number.isFinite(x.at))
      .map((x) => ({ tx: x.tx, label: x.label.slice(0, 80), chain: x.chain, who: x.who, at: x.at }));
  } catch {
    return [];
  }
}

/** What to restore for the account and chain now connected. */
export const forAccount = (saved: Saved[], who: string, chain: number, now: number) =>
  saved.filter((x) => x.who === who && x.chain === chain && now - x.at < KEEP_MS);

/** A receipt lookup's result: a receipt, none yet, or the RPC could not answer. */
export type Lookup = { status: "success" | "reverted"; block: bigint } | null | "error";

/** Next state of an unresolved item after one receipt lookup. Never sends, retries or signs anything. */
export function reconcile(t: TxItem, r: Lookup, now: number, waitMs = 3 * 60_000): Partial<TxItem> | null {
  if (r === "error") return null; // a failed read says nothing about the transaction
  if (r === null) {
    if (t.state === "pending" && now - t.at >= waitMs)
      return { state: "unknown", text: "Not confirmed yet. It may still go through: check the explorer before sending again. Close this notice to allow new transactions." };
    return null;
  }
  if (r.status === "success") return { state: "done", text: `Confirmed in block ${r.block}`, block: r.block };
  return { state: "failed", text: "Reverted onchain. Nothing changed except the network fee.", block: r.block };
}

/** Unresolved transactions that pause new sends until they resolve or the user closes the notice after checking. */
export const blocking = (list: TxItem[], account: string | null) => mine(list, account).filter((t) => unresolved(t) && !t.acked);
