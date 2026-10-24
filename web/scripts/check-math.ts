// node scripts/check-math.ts — asserts the cover-shortfall and rounding rules the app shows to users.
import assert from "node:assert/strict";
import { voteSplit, voteOutcome, borrowLimit, collateralOut, collateralValue, coverExit, coverForShares, debtOf, ltvBps, marketStatus, coverFreeAfter, coverShareBps, coverShortfall, down2, fmt, fmtCoverShare, fmtDown, minCoverBps, pctTrim, roomAfterCover, sharesForCover, up2 } from "../src/app/math.ts";

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
// ---------------------------------------------------------------- market status in the contract's terms
const mk = (senior: bigint, junior: bigint, capacity: bigint, undercovered = false) => ({ senior, junior, capacity, undercovered, maxLeverage: 19n });
assert.equal(marketStatus(mk(0n, 0n, 0n)), "empty");                          // Steady today: nothing posted
assert.equal(marketStatus(mk(1000n * E, 54n * E, 26n * E)), "open");
assert.equal(marketStatus(mk(190n * E, 10n * E, 0n)), "full");                // exactly at 19x: room exhausted
assert.equal(marketStatus(mk(1000n * E, 40n * E, 0n, true)), "needs-cover");
assert.equal(marketStatus(mk(100n * E, 0n, 0n)), "needs-cover", "lenders with no cover need cover even if the flag lags");
assert.equal(marketStatus(mk(0n, 5n * E, 95n * E)), "open", "cover alone opens room");

// ---------------------------------------------------------------- cover withdrawal states
const vault = { senior: 1000n * E, junior: 54_400_000_000_000_000_000n, maxLeverage: 19n, totalJuniorShares: 544_000_000n * E, round: 0n, withdrawWindow: 86_400n } as never;
const holder = (shares: bigint, readyAt: bigint, round = 0n) => ({ junior: 15n * E, juniorShares: 150_000_000n * E, request: { round, readyAt, shares } });
const T = 1_800_000_000n;
const none = coverExit(vault, holder(0n, 0n), T);
assert.equal(none.kind, "none");
assert.ok(none.available > 1n * E && none.available < 2n * E, "available to request is the free cover, not the whole holding");
assert.equal(coverExit(vault, holder(10_000_000n * E, T + 600n), T).kind, "pending");
assert.equal(coverExit(vault, holder(10_000_000n * E, T), T).kind, "ready", "ready from the second the notice ends");
assert.equal(coverExit(vault, holder(100_000_000n * E, T - 1n), T).kind, "unavailable", "more than may leave: the vault would refuse it");
assert.equal(coverExit(vault, holder(10_000_000n * E, T - 86_400n), T).kind, "ready", "last second of the window still counts");
assert.equal(coverExit(vault, holder(10_000_000n * E, T - 86_401n), T).kind, "expired");
assert.equal(coverExit(vault, holder(10_000_000n * E, T, 1n), T).kind, "none", "a request from a wiped-out round is void");

// ---------------------------------------------------------------- safe collateral withdrawal (Morpho rounding, 1 h buffer)
const P = 10n * 10n ** 36n, LLTV = 770_000_000_000_000_000n, APR = 0n; // 10 MUSD per MEZO, 77%
assert.deepEqual(collateralOut(5n * E, 0n, P, LLTV, APR), { known: true, max: 5n * E }, "no debt: everything may leave");
assert.deepEqual(collateralOut(5n * E, 10n * E, 0n, LLTV, APR), { known: false, max: 0n }, "no oracle price: can't check, nothing offered");
const out = collateralOut(5n * E, 10n * E, P, LLTV, APR);
const left = 5n * E - out.max;
assert.ok(borrowLimit(left, P, LLTV) >= 10n * E + 1n, "what stays still covers the debt");
assert.ok(borrowLimit(left - 1n, P, LLTV) < 10n * E + 1n, "and it is the smallest such amount (exact boundary)");
assert.ok(out.max > 3n * E && out.max < 4n * E);                               // needs ~1.2987 MEZO, so ~3.70 may leave
const withRate = collateralOut(5n * E, 10n * E, P, LLTV, 120_000_000_000_000_000n); // 12% APR
assert.ok(withRate.max < out.max, "accruing interest is reserved, never overstated");
assert.equal(collateralOut(1n * E, 8n * E, P, LLTV, APR).max, 0n, "already beyond the limit: nothing may leave");
const marginOut = collateralOut(5n * E, 10n * E, P, (LLTV * 85n) / 100n, APR);    // what Max fills: 85% of the limit
assert.ok(marginOut.max < out.max && ltvBps(10n * E, collateralValue(5n * E - marginOut.max, P))! <= 6545n, "Max keeps a margin below the limit");
const near = collateralOut(13n * E / 10n, 10n * E, P, LLTV, APR);           // LTV ~76.9%: a sliver at most
assert.ok(near.max < 2n * 10n ** 15n, near.max.toString());

// ---------------------------------------------------------------- veBTC vote allocation
const VB = "0xbold", VS = "0xsteady";
assert.deepEqual(voteSplit([VB], {}), { vaults: [VB], weights: [100n], pct: { [VB]: 100 } }, "one eligible market: the whole vote, no slider needed");
assert.deepEqual(voteSplit([VB], { [VB]: 7 }).weights, [100n], "a stray slider value can't change a single-market vote");
assert.deepEqual(voteSplit([VB, VS], {}).vaults, [], "several markets and nothing chosen: nothing to send");
const two = voteSplit([VB, VS], { [VB]: 30, [VS]: 10 });
assert.deepEqual(two.vaults, [VB, VS]); assert.deepEqual(two.weights, [30n, 10n]);
assert.deepEqual(two.pct, { [VB]: 75, [VS]: 25 }, "relative weights normalised");
const odd = voteSplit([VB, VS], { [VB]: 2, [VS]: 1 });
assert.deepEqual(odd.pct, { [VB]: 66.7, [VS]: 33.3 }, "shown to a tenth, as the gauge splits power x weight / sum");
const thirds = voteSplit([VB, VS, "0xc"], { [VB]: 1, [VS]: 1, "0xc": 1 });
assert.equal(Math.round(Object.values(thirds.pct).reduce((a, b) => a + b, 0) * 10), 1000, "percentages always add up to 100.0");
assert.deepEqual(voteSplit([VB, VS], { [VB]: 50, [VS]: 0 }).vaults, [VB], "a market at zero is left out of the vote");

// Live gauge on 23 Oct 2026, epoch 473: position #402 (power 0.000174328703642340) still holds 0.000178170524628642 of
// Bold's votes from an earlier epoch; Bold is far over its cover cap, Steady (5 MUSD cover) has no votes yet.
const live = [{ vault: VB, votes: 924867283625064n, coverCap: 543999474335150n }, { vault: VS, votes: 0n, coverCap: 50000000000000n }];
const mine402 = { [VB]: 178170524628642n }, PW = 174328703642340n;
const half = voteOutcome(live, mine402, PW, voteSplit([VB, VS], { [VB]: 50, [VS]: 50 }));
assert.equal(half[VS].added, PW / 2n, "the gauge gives each market power x weight / sum");
assert.equal(half[VB].votes, 924867283625064n - 178170524628642n + PW / 2n, "the position's standing votes are reset first");
assert.equal(half[VS].weight, 50000000000000n, "Steady's effective weight stops at its cover cap");
assert.deepEqual([half[VB].bps, half[VS].bps], [9158, 841], "50/50 now: Bold 91.6%, Steady 8.4% (not the current 100/0)");
assert.ok(half[VB].capped && half[VS].capped);
const allBold = voteOutcome(live, mine402, PW, voteSplit([VB, VS], { [VB]: 100, [VS]: 0 }));
assert.deepEqual([allBold[VB].bps, allBold[VS].bps], [10000, 0], "all to Bold: Steady stays at 0");
const tiny = voteOutcome(live, mine402, PW, voteSplit([VB, VS], { [VB]: 99, [VS]: 1 }));
assert.equal(tiny[VS].weight, PW / 100n, "below the cap, effective weight is the votes");
assert.ok(!tiny[VS].capped);
assert.equal(voteOutcome(live, mine402, PW, { vaults: [], weights: [] })[VB].votes, 924867283625064n - 178170524628642n, "nothing chosen: only the reset");

// limits a typed amount is checked against are shown rounded down, so typing the shown figure never fails
assert.equal(fmtDown(33_598_946_478_778_499_151n), "33.59"); // Bold room to lend, 23 Oct 2026 (fmt rounds it up to 33.60)
assert.equal(fmtDown(19_999_998_000_000_000_000n), "19.99"); // founder MUSD after Journey 4
assert.equal(fmtDown(98_165_441_000_000_000_000n, 4), "98.1654");
assert.equal(fmtDown(35n * E), "35.00");
console.log("math ok");
