// node scripts/check-math.ts — asserts the cover-shortfall and rounding rules the app shows to users.
import assert from "node:assert/strict";
import { coverFreeAfter, coverShortfall, down2, fmt, minCoverBps, pctTrim, roomAfterCover, up2 } from "../src/app/math.ts";

const E = 10n ** 18n;
// Bold MEZO as read on 21 Oct 2026: 1,000.0000532 MUSD senior behind 39.3999468 MUSD cover, 19x cap
const bold = { senior: 1_000_000_053_210_176_469_100n, junior: 39_399_946_789_823_529_463n, maxLeverage: 19n } as never;
const gap = coverShortfall(bold);
assert.ok(gap > 13n * E && gap < 14n * E);
assert.equal(fmt(up2(gap)), "13.24");           // rounded up, never understated
assert.equal(fmt(13_230_000_000_000_000_000n), "13.23");
assert.equal(up2(13_230_000_000_000_000_000n), 13_230_000_000_000_000_000n); // exact cents stay put
assert.equal(minCoverBps(bold), 500n);          // 1 / (19 + 1)
assert.equal(minCoverBps({ maxLeverage: 9n } as never), 1000n);
assert.equal(coverShortfall({ senior: 190n * E, junior: 10n * E, maxLeverage: 19n } as never), 0n); // exactly at the cap
assert.equal(coverShortfall({ senior: 0n, junior: 0n, maxLeverage: 9n } as never), 0n);
assert.equal(pctTrim(7700n), "77%");
assert.equal(pctTrim(6250n), "62.5%");

// Posting 20 MUSD of cover on Bold: 59.3999 x 19 = 1,128.5990 cap, minus 1,000.0001 of existing lenders.
// Not 19 x 20 = 380: the existing lenders use up most of the new cap.
const twenty = 20n * E;
assert.equal(roomAfterCover(bold), 0n);                                   // under-covered today
assert.equal(roomAfterCover(bold, twenty), 128_598_935_796_470_590_697n);  // exact, in wei
assert.equal(fmt(down2(roomAfterCover(bold, twenty))), "128.59");          // shown rounded down, never overstated
assert.equal(fmt(down2(coverFreeAfter(bold, twenty))), "6.76");            // 59.3999 - 52.6316 needed by lenders
assert.equal(coverFreeAfter(bold), 0n);
assert.equal(roomAfterCover(bold, 13n * E), 0n);                           // still short of the 13.2316 gap
// Steady MEZO: empty vault, 9x cap. Cover alone opens 9x; all of it could leave while nobody lends.
const steady = { senior: 0n, junior: 0n, maxLeverage: 9n } as never;
assert.equal(roomAfterCover(steady), 0n);
assert.equal(roomAfterCover(steady, twenty), 180n * E);
assert.equal(coverFreeAfter(steady, twenty), twenty);
assert.equal(coverShortfall(steady), 0n);
// Exactly at the cap: no room, no free cover; a zero-leverage vault never opens room.
const atCap = { senior: 190n * E, junior: 10n * E, maxLeverage: 19n } as never;
assert.equal(roomAfterCover(atCap), 0n);
assert.equal(coverFreeAfter(atCap), 0n);
assert.equal(roomAfterCover({ senior: 0n, junior: 5n * E, maxLeverage: 0n } as never, twenty), 0n);
assert.equal(down2(128_599_999_999_999_999_999n), 128_590_000_000_000_000_000n);
console.log("math ok");
