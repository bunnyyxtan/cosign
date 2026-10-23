// Pure money helpers shared by the app screens. Checked by scripts/check-math.ts.
import { formatUnits, parseUnits } from "viem";
import type { MarketState } from "../chain";

export const WAD = 10n ** 18n;
export const fmt = (v: bigint, dp = 2) =>
  Number(formatUnits(v, 18)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const pct = (bps: bigint | number, dp = 1) => `${(Number(bps) / 100).toFixed(dp)}%`;
/** A percentage without a trailing ".0" (77%, 62.5%). */
export const pctTrim = (bps: bigint | number) => `${Number((Number(bps) / 100).toFixed(2))}%`;
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const apr = (x: number) => `${(x * 100).toFixed(2)}%`;
export const toWei = (s: string) => {
  try {
    return s ? parseUnits(s, 18) : 0n;
  } catch {
    return 0n;
  }
};

/** APRs from live chain state. Lender base = borrow APR x utilisation (Morpho fee is 0). */
export function aprs(m: MarketState) {
  const util = m.totalSupply === 0n ? 0 : Number(m.totalBorrow) / Number(m.totalSupply);
  const base = (Number(m.borrowApr) / 1e18) * util;
  const prem = Number(m.premiumBps) / 10_000;
  const s = Number(m.senior), j = Number(m.junior);
  return {
    util,
    borrow: Number(m.borrowApr) / 1e18,
    senior: base * (1 - prem),
    junior: j > 0 ? base * (1 + (prem * s) / j) : 0,
  };
}

/** Minimum cover share of the vault: lenders may hold at most maxLeverage x cover. */
export const minCoverBps = (m: MarketState) => 10_000n / (m.maxLeverage + 1n);

/** Rounds up to the cent, so a shortfall is never understated. */
export const up2 = (v: bigint) => ((v + 10n ** 16n - 1n) / 10n ** 16n) * 10n ** 16n;

/** A co-signer's share of the market's cover from share accounting (their shares / all cover shares), in basis
 *  points rounded down. Null when the market has no cover shares. Not the market's cover ratio (coverageBps). */
export function coverShareBps(mine: bigint, total: bigint) {
  if (total === 0n) return null;
  return (mine * 10_000n) / total;
}

/** "33.67%", "100%", "<0.01%" for a holding too small to show, "0%" for none, "—" when the market has no cover. */
export function fmtCoverShare(mine: bigint, total: bigint) {
  const bps = coverShareBps(mine, total);
  if (bps === null) return "—";
  if (mine > 0n && bps === 0n) return "<0.01%";
  return pctTrim(bps);
}

/** Shares to request so that at most `amount` of cover leaves: every share once the amount covers the whole holding. */
export function sharesForCover(amount: bigint, mineAssets: bigint, mineShares: bigint) {
  if (mineShares === 0n || mineAssets === 0n || amount === 0n) return 0n;
  return amount >= mineAssets ? mineShares : (amount * mineShares) / mineAssets;
}

/** What a number of cover shares is worth now, rounded down, with the vault's virtual offsets (1 asset, 1e6 shares). */
export const coverForShares = (shares: bigint, m: MarketState) => (shares * (m.junior + 1n)) / (m.totalJuniorShares + 1_000_000n);

/** Rounds down to the cent, so room and withdrawable amounts are never overstated. */
export const down2 = (v: bigint) => (v / 10n ** 16n) * 10n ** 16n;

/** Cover the current lenders require: lenders may hold at most maxLeverage x cover. Rounded up to the wei. */
const coverNeeded = (m: MarketState) => (m.maxLeverage === 0n ? 0n : (m.senior + m.maxLeverage - 1n) / m.maxLeverage);

/** Cover still needed before lender deposits reopen (zero when the market is covered). */
export function coverShortfall(m: MarketState) {
  const need = coverNeeded(m);
  return need > m.junior ? need - m.junior : 0n;
}

/** Room for new lender deposits once `extra` cover is added. Existing lenders use up cap before new ones do. */
export function roomAfterCover(m: MarketState, extra = 0n) {
  const cap = (m.junior + extra) * m.maxLeverage;
  return cap > m.senior ? cap - m.senior : 0n;
}

/** How far cover could shrink, once `extra` is added, before it drops below what today's lenders require. */
export function coverFreeAfter(m: MarketState, extra = 0n) {
  if (m.senior === 0n) return m.junior + extra;
  const need = coverNeeded(m);
  return m.junior + extra > need ? m.junior + extra - need : 0n;
}

export const marketKey = (m: MarketState) => (m.name.toLowerCase().includes("steady") ? "steady" : "bold");

/** Morpho borrow shares to MUSD owed, rounded up (virtual shares 1e6, virtual assets 1), so debt is never understated. */
export function debtOf(borrowShares: bigint, m: Pick<MarketState, "totalBorrow" | "totalBorrowShares">) {
  return borrowShares === 0n ? 0n : (borrowShares * (m.totalBorrow + 1n)) / (m.totalBorrowShares + 1_000_000n) + 1n;
}

/** Collateral value in MUSD at the oracle price (Morpho scales prices by 1e36). */
export const collateralValue = (collateral: bigint, price: bigint) => (collateral * price) / 10n ** 36n;

/** Loan-to-value in basis points, or null without collateral. Liquidation is possible once it reaches the market's LLTV. */
export function ltvBps(debt: bigint, value: bigint) {
  return value === 0n ? null : (debt * 10_000n) / value;
}

// ---------------------------------------------------------------- what a screen may say about a market or a position

/** Lender-deposit status in the contract's own terms. Borrowing on Morpho is separate and not covered here. */
export type MarketStatusKind = "open" | "full" | "needs-cover" | "empty";
export function marketStatus(m: Pick<MarketState, "senior" | "junior" | "capacity" | "undercovered" | "maxLeverage">): MarketStatusKind {
  if (m.senior === 0n && m.junior === 0n) return "empty";
  if (m.undercovered || (m.capacity === 0n && coverShortfall(m as MarketState) > 0n)) return "needs-cover";
  if (m.capacity === 0n) return "full";
  return "open";
}

/**
 * A co-signer's withdrawal, decoded from live state. `available` is what may enter a new request now (lenders may
 * hold at most maxLeverage x the cover that stays); it is not money that can be withdrawn yet.
 *   none        no request
 *   pending     notice running; cover still pays losses
 *   ready       notice over, inside the window, and the vault would accept it now
 *   unavailable notice over, but withdrawing now would break the minimum cover, so the vault would refuse it
 *   expired     the window after the notice closed
 */
export type ExitKind = "none" | "pending" | "ready" | "unavailable" | "expired";
export function coverExit(m: MarketState, me: { junior: bigint; juniorShares: bigint; request: { round: bigint; readyAt: bigint; shares: bigint } } | undefined, now: bigint) {
  const free = coverFreeAfter(m);
  const available = me ? (me.junior < free ? me.junior : free) : 0n;
  const req = me?.request;
  const live = !!req && req.shares > 0n && req.round === m.round;
  if (!me || !live) return { kind: "none" as ExitKind, available, amount: 0n, shares: 0n, readyAt: 0n, deadline: 0n };
  const shares = req!.shares < me.juniorShares ? req!.shares : me.juniorShares;
  const amount = coverForShares(shares, m);
  const readyAt = req!.readyAt, deadline = req!.readyAt + m.withdrawWindow;
  const kind: ExitKind = now > deadline ? "expired" : now < readyAt ? "pending" : amount > free ? "unavailable" : "ready";
  return { kind, available, amount, shares, readyAt, deadline };
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
/** Morpho's borrow limit for `c` collateral: floor(floor(c x price / 1e36) x lltv / 1e18). */
export const borrowLimit = (c: bigint, price: bigint, lltv: bigint) => (((c * price) / 10n ** 36n) * lltv) / WAD;

/**
 * The most collateral that can leave while the loan stays inside its limit, assuming an hour of interest accrues
 * before the transaction lands. Rounds against the user throughout, so it never overstates. `known` is false when the
 * oracle price or the market's limit is unavailable, so safety can't be checked.
 */
export function collateralOut(collateral: bigint, debt: bigint, price: bigint, lltv: bigint, borrowApr: bigint, bufferSec = 3600n) {
  if (debt === 0n) return { known: true, max: collateral };
  if (price === 0n || lltv === 0n) return { known: false, max: 0n };
  const owed = debt + ceilDiv(debt * borrowApr * bufferSec, WAD * 31_536_000n) + 1n;
  let need = ceilDiv(ceilDiv(owed * WAD, lltv) * 10n ** 36n, price);
  while (borrowLimit(need, price, lltv) < owed) need += 1n;
  return { known: true, max: collateral > need ? collateral - need : 0n };
}
