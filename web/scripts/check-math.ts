// node scripts/check-math.ts — asserts the cover-shortfall and rounding rules the app shows to users.
import assert from "node:assert/strict";
import { coverShortfall, fmt, minCoverBps, pctTrim, up2 } from "../src/app/math.ts";

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
console.log("math ok");
