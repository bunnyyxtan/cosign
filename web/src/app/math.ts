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

/** Cover still needed before lender deposits reopen (zero when the market is covered). Rounded up to the wei. */
export function coverShortfall(m: MarketState) {
  if (m.maxLeverage === 0n) return 0n;
  const need = (m.senior + m.maxLeverage - 1n) / m.maxLeverage;
  return need > m.junior ? need - m.junior : 0n;
}

export const marketKey = (m: MarketState) => (m.name.toLowerCase().includes("steady") ? "steady" : "bold");
