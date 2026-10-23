// node scripts/check-routes.ts — asserts the app's URLs: canonical paths, unknown routes, and old hash links.
import assert from "node:assert/strict";
import { legacyPath, parsePath, pathOf, slugTable } from "../src/app/routes.ts";

const BOLD = "0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7", STEADY = "0x8f89117d71269E35D980905327e4C1252294B4a9";
const slugOf = slugTable({ bold: BOLD, steady: STEADY });

// Every canonical path parses and prints back to itself.
for (const p of ["/app/markets", "/app/markets/bold", "/app/markets/bold/borrow", "/app/markets/steady", "/app/markets/steady/borrow",
  "/app/co-sign", "/app/co-sign/bold", "/app/co-sign/steady", "/app/rewards", "/app/portfolio", "/app/evidence"]) {
  assert.equal(pathOf(parsePath(p)), p, p);
  assert.equal(pathOf(parsePath(p + "/")), p, "a trailing slash is the same page");
}
assert.deepEqual(parsePath("/app"), { page: "markets" });
assert.deepEqual(parsePath("/app/"), { page: "markets" });
assert.deepEqual(parsePath("/app/Markets/BOLD"), { page: "market", slug: "bold", tab: "lend" }, "case-insensitive");

// Unknown routes are reported, not silently sent to Markets.
assert.deepEqual(parsePath("/app/markets/doge"), { page: "notfound", what: "market" });
assert.deepEqual(parsePath(`/app/markets/${BOLD}`), { page: "notfound", what: "market" }, "an address in the URL is never a market");
assert.deepEqual(parsePath("/app/co-sign/doge"), { page: "notfound", what: "market" });
assert.deepEqual(parsePath("/app/markets/bold/lend/extra"), { page: "notfound", what: "page" });
assert.deepEqual(parsePath("/app/markets/bold/repay"), { page: "notfound", what: "page" });
assert.deepEqual(parsePath("/app/settings"), { page: "notfound", what: "page" });
assert.deepEqual(parsePath("/app/rewards/extra"), { page: "notfound", what: "page" });
assert.deepEqual(parsePath("/application"), { page: "notfound", what: "page" });

// Old shared links keep their intent.
assert.equal(legacyPath(`#/market/${BOLD}`, slugOf), "/app/markets/bold");
assert.equal(legacyPath(`#/market/${BOLD.toLowerCase()}/borrow`, slugOf), "/app/markets/bold/borrow");
assert.equal(legacyPath(`#/market/${STEADY}`, slugOf), "/app/markets/steady");
assert.equal(legacyPath(`#/cosign/${STEADY}`, slugOf), "/app/co-sign/steady");
assert.equal(legacyPath("#/cosign", slugOf), "/app/co-sign");
assert.equal(legacyPath("#/positions", slugOf), "/app/portfolio");
assert.equal(legacyPath("#/portfolio", slugOf), "/app/portfolio");
assert.equal(legacyPath("#/markets", slugOf), "/app/markets");
assert.equal(legacyPath("#/rewards", slugOf), "/app/rewards");
assert.equal(legacyPath("#/evidence", slugOf), "/app/evidence");
assert.equal(legacyPath("#/market/0x000000000000000000000000000000000000dEaD", slugOf), "/app/markets/unknown-market", "an unknown address stays 'a market', not Markets");
assert.equal(parsePath("/app/markets/unknown-market").page, "notfound");
assert.equal(legacyPath("", slugOf), null);
assert.equal(legacyPath("#replay", slugOf), null, "plain anchors are not routes");
assert.equal(slugTable({ bold: "0x0000000000000000000000000000000000000000" })("0x0000000000000000000000000000000000000000"), undefined, "an undeployed vault has no slug");

console.log("routes ok");
