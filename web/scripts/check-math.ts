// node scripts/check-math.ts — asserts the cover-shortfall and rounding rules the app shows to users.
import assert from "node:assert/strict";
import { collateralValue, coverForShares, debtOf, ltvBps, coverFreeAfter, coverShareBps, coverShortfall, down2, fmt, fmtCoverShare, minCoverBps, pctTrim, roomAfterCover, sharesForCover, up2 } from "../src/app/math.ts";

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
// A co-signer's share of cover comes from share accounting, not the market's cover ratio. Founder test wallet on Bold,
// read on 21 Oct 2026: 203,045,959.5e18 of 603,045,959.5e18 cover shares, while the cover ratio is 5.6%.
const mine = 203_045_959_495_211_582_983_073_218n, all = 603_045_959_495_211_582_983_073_218n;
assert.equal(coverShareBps(mine, all), 3367n);          // 33.67%, rounded down (exact 33.6702%)
assert.equal(fmtCoverShare(mine, all), "33.67%");
assert.equal(fmtCoverShare(all, all), "100%");          // sole co-signer
assert.equal(fmtCoverShare(0n, all), "0%");
assert.equal(fmtCoverShare(1n, all), "<0.01%");          // a holding too small to show is never shown as 0
assert.equal(fmtCoverShare(0n, 0n), "—");                // no cover at all (e.g. empty Steady, or a wiped round)
assert.equal(coverShareBps(all - 1n, all), 9999n);       // never rounds up to 100% while someone else holds cover
// Partial cover withdrawal. Bold on 23 Oct 2026: cover 59.3999 MUSD on 603,045,959.5e18 shares; the founder holds
// 203,045,959.5e18 shares worth 20 MUSD; lenders 1,010.0000532 MUSD, 19x cap.
const boldNow = { senior: 1_010_000_053_210_176_469_100n, junior: 59_399_946_789_823_529_463n, maxLeverage: 19n, totalJuniorShares: 603_045_959_495_211_582_983_073_218n } as never;
const myShares = 203_045_959_495_211_582_983_073_218n, myCover = coverForShares(myShares, boldNow);
assert.equal(fmt(myCover), "20.00");                                          // what the app shows as "Your cover"
assert.equal(sharesForCover(myCover, myCover, myShares), myShares);            // the whole holding asks for every share
assert.equal(sharesForCover(myCover + 1n, myCover, myShares), myShares);       // never more shares than held
assert.equal(sharesForCover(0n, myCover, myShares), 0n);
assert.equal(sharesForCover(5n * E, myCover, myShares), (5n * E * myShares) / myCover);  // proportional, rounded down
assert.ok(coverForShares(sharesForCover(5n * E, myCover, myShares), boldNow) <= 5n * E);  // never withdraws more than asked
assert.equal(fmt(down2(coverFreeAfter(boldNow))), "6.24");                      // 59.3999 - ceil(1010.0000532 / 19) = 6.2420
assert.ok(5n * E <= coverFreeAfter(boldNow) && 7n * E > coverFreeAfter(boldNow)); // 5 may leave, 7 may not
const noLenders = { senior: 0n, junior: 59_399_946_789_823_529_463n, maxLeverage: 19n, totalJuniorShares: 603_045_959_495_211_582_983_073_218n } as never;
assert.equal(coverFreeAfter(noLenders), 59_399_946_789_823_529_463n);           // nobody to protect: all cover can leave
assert.equal(sharesForCover(5n * E, 0n, 0n), 0n);                              // no holding, nothing to request
// Debt from Morpho borrow shares rounds up (never understated); LTV is debt over collateral value at the oracle price.
assert.equal(debtOf(0n, { totalBorrow: 10n * E, totalBorrowShares: 10n * E * 1_000_000n } as never), 0n);
const owed = debtOf(10n * E * 1_000_000n, { totalBorrow: 10n * E, totalBorrowShares: 10n * E * 1_000_000n } as never);
assert.ok(owed >= 10n * E && owed <= 10n * E + 2n);
assert.equal(collateralValue(5n * E, 10n * 10n ** 36n), 50n * E);   // 5 MEZO at 10 MUSD
assert.equal(ltvBps(10n * E, 50n * E), 2000n);                       // 10 / 50 = 20%
assert.equal(ltvBps(1n, 0n), null);
console.log("math ok");
