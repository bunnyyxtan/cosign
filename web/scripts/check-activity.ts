// node scripts/check-activity.ts — asserts the transaction-notice rules: what stays, what hides itself, and when.
import assert from "node:assert/strict";
import { add, blocking, dismiss, explain, forAccount, inFlight, isOpen, KEEP_MS, lifetime, mine, parseSaved, reconcile, sweep, toasts, toSave, update, type TxItem } from "../src/app/activity.ts";

const A = "0xF08043221338c621b6f2f387AF70B33797629371";
const B = "0x5C601923FE736A2dcA69D892c10720fb584dd1e4";
const T0 = 1_000_000;
const base = { account: A, label: "Deposit MUSD", text: "", at: T0 };
const one = (l: TxItem[]) => l[0];

// Pending signature and pending onchain never hide and can't be dismissed.
let l = add([], { ...base, id: 1, state: "signing" });
assert.equal(one(l).shown, true);
assert.equal(one(l).hideAt, undefined);
l = dismiss(l, 1);
assert.equal(one(l).shown, true, "an unresolved transaction can't be dismissed");
l = update(l, 1, { state: "pending", tx: "0xabc" }, T0 + 1000);
l = sweep(l, T0 + 10 * 60_000);
assert.equal(one(l).shown, true, "pending never times out");
assert.equal(inFlight(l, A), 1);

// Confirmed but still syncing: not hidden, not called a failure.
l = update(l, 1, { state: "syncing" }, T0 + 2000);
assert.ok(isOpen(one(l).state));
l = sweep(l, T0 + 60_000);
assert.equal(one(l).shown, true);

// Confirmed and synced: hides itself after about six seconds, and stays in the activity list.
l = update(l, 1, { state: "done", text: "Confirmed in block 7" }, T0 + 3000);
assert.equal(lifetime("done"), 6000);
assert.equal(sweep(l, T0 + 8999), l, "nothing changes before its time");
l = sweep(l, T0 + 9000);
assert.equal(one(l).shown, false, "a success hides itself");
assert.equal(mine(l, A).length, 1, "the record stays in this session's activity");
assert.equal(inFlight(l, A), 0);

// Hover or focus holds it; it leaves only after a grace period once released.
l = add([], { ...base, id: 2, state: "signing" });
l = update(l, 2, { state: "done" }, T0);
l = sweep(l, T0 + 5900, true);
assert.equal(one(l).shown, true);
assert.equal(one(l).hideAt, T0 + 5900 + 2000, "held toasts get a grace period");
l = sweep(l, T0 + 7000, true);
assert.equal(one(l).hideAt, T0 + 9000, "holding keeps pushing the deadline");
l = sweep(l, T0 + 8999);
assert.equal(one(l).shown, true, "released, but its grace period isn't over");
l = sweep(l, T0 + 9000);
assert.equal(one(l).shown, false);

// Errors stay until dismissed; a rejection is not a failure and leaves sooner.
l = add([], { ...base, id: 3, state: "signing" });
l = update(l, 3, { state: "failed", text: "Reverted onchain" }, T0);
assert.equal(lifetime("failed"), undefined);
l = sweep(l, T0 + 60 * 60_000);
assert.equal(one(l).shown, true, "a failure stays until the user closes it");
l = dismiss(l, 3);
assert.equal(one(l).shown, false);
assert.equal(lifetime("rejected"), 8000);
assert.equal(explain({ code: 4001, message: "User rejected the request." }).state, "rejected");
assert.equal(explain(new Error("User denied transaction signature")).state, "rejected");

// Confirmed-but-unread and no-receipt-yet must stay: the user has to see them before sending again.
assert.equal(lifetime("unsynced"), undefined);
assert.equal(lifetime("unknown"), undefined);

// An approval keeps its next step on the toast while visible; the toast still hides itself on schedule.
let ran = 0;
l = add([], { ...base, id: 4, label: "Approve MUSD", state: "signing" });
l = update(l, 4, { state: "approved", text: "MUSD approved. Next: deposit.", next: { ready: "deposit", label: "Deposit 10.00 MUSD", run: () => ran++ } }, T0);
assert.equal(one(l).next?.label, "Deposit 10.00 MUSD");
assert.equal(ran, 0, "the next step never starts by itself");
l = sweep(l, T0 + 6000);
assert.equal(one(l).shown, false, "the approval toast hides; the form keeps offering the next step");

// Re-entering a state re-shows a hidden notice (for example a retry after a failure).
l = update(l, 4, { state: "failed" }, T0 + 7000);
assert.equal(one(l).shown, true);

// Another connected account never sees these.
l = add([], { ...base, id: 5, state: "pending" });
assert.equal(toasts(l, A).length, 1);
assert.equal(toasts(l, B).length, 0);
assert.equal(toasts(l, null).length, 0);
assert.equal(mine(l, A.toLowerCase()).length, 1, "address case doesn't matter");

// Raw RPC text is never the headline.
const rpc = explain(new Error('HTTP request failed. URL: https://rpc.test.mezo.org Request body: {"method":"eth_estimateGas"} execution reverted'));
assert.equal(rpc.state, "failed");
assert.ok(!/rpc\.test|eth_estimateGas/.test(rpc.text));
assert.ok(rpc.detail);
assert.match(explain(new Error("execution reverted: CapacityExceeded()")).text, /room to lend/);

// viem nests the wallet's error: codes and messages are read from the whole chain.
const nested = { shortMessage: 'The contract function "withdrawSenior" reverted with the following reason:', cause: { message: "Internal JSON-RPC error.", code: -32603, cause: { message: "header not found" } } };
assert.match(explain(nested).text, /wallet could not complete/);
assert.equal(explain({ shortMessage: "x", cause: { code: 4001, message: "no" } }).state, "rejected");
assert.match(explain({ shortMessage: "Execution reverted", cause: { message: "execution reverted: Undercovered()" } }).text, /minimum cover/);
assert.match(explain({ shortMessage: "Execution reverted", cause: { message: "execution reverted" } }).text, /would reject/);
// ---------------------------------------------------------------- recovery across reloads
const tagOf = (a: string) => "tag:" + a.toLowerCase(); // stands in for the keccak tag
const H1 = ("0x" + "11".repeat(32)) as `0x${string}`, H2 = ("0x" + "22".repeat(32)) as `0x${string}`;
const CHAIN = 31611;

// Reload while pending: the hash is saved for this account and chain, and comes back after the reload.
let s1 = add([], { id: 10, account: A, label: "Deposit MUSD", state: "signing", text: "", at: T0 });
assert.equal(toSave([], s1, tagOf(A), CHAIN, T0, tagOf).length, 0, "nothing to save before there is a hash");
s1 = update(s1, 10, { state: "pending", tx: H1 }, T0 + 500);
let saved = toSave([], s1, tagOf(A), CHAIN, T0 + 500, tagOf);
assert.deepEqual(saved, [{ tx: H1, label: "Deposit MUSD", chain: CHAIN, who: tagOf(A), at: T0 }]);
assert.ok(!JSON.stringify(saved).includes(A.slice(2)), "no address is stored");
const reloaded = parseSaved(JSON.stringify(saved));
assert.equal(forAccount(reloaded, tagOf(A), CHAIN, T0 + 60_000).length, 1, "restored after a reload");

// Account switching and another chain: neither sees it, and saving for B keeps A's record.
assert.equal(forAccount(reloaded, tagOf(B), CHAIN, T0 + 60_000).length, 0);
assert.equal(forAccount(reloaded, tagOf(A), 1, T0 + 60_000).length, 0);
saved = toSave(reloaded, [], tagOf(B), CHAIN, T0 + 60_000, tagOf);
assert.equal(saved.length, 1, "B's empty list doesn't erase A's unresolved hash");

// Malformed or hostile storage is ignored.
assert.deepEqual(parseSaved("not json"), []);
assert.deepEqual(parseSaved(JSON.stringify([{ tx: "0x12", label: "x", chain: CHAIN, who: "w", at: 1 }, { tx: H2, label: 5 }])), []);
assert.equal(parseSaved(JSON.stringify([{ tx: H1, label: "y".repeat(500), chain: CHAIN, who: "w", at: 1 }]))[0].label.length, 80);

// Receipt unavailable: a missing receipt keeps it pending, then unknown after the wait; an RPC error changes nothing.
let r1: TxItem = { ...s1[0], restored: true };
assert.equal(reconcile(r1, "error", T0 + 10 * 60_000), null, "a failed lookup says nothing about the transaction");
assert.equal(reconcile(r1, null, T0 + 60_000), null, "no receipt yet: still pending");
const unk = reconcile(r1, null, T0 + 3 * 60_000)!;
assert.equal(unk.state, "unknown");
let s2 = update([r1], 10, unk, T0 + 3 * 60_000);
assert.equal(toSave([], s2, tagOf(A), CHAIN, T0 + 3 * 60_000, tagOf).length, 1, "an unknown outcome stays saved");

// An unknown outcome pauses new sends until it resolves or the user closes it after checking.
assert.equal(blocking(s2, A).length, 1);
assert.equal(blocking(s2, B).length, 0, "it never blocks another account");
assert.equal(blocking(dismiss(s2, 10), A).length, 0, "closing it after checking the explorer allows new sends");
assert.equal(toSave([], dismiss(s2, 10), tagOf(A), CHAIN, T0, tagOf).length, 1, "closing it doesn't forget the hash");
assert.equal(blocking(add([], { id: 11, account: A, label: "x", state: "pending", tx: H2, text: "", at: T0 }), A).length, 1, "a pending hash blocks too");

// Eventual success: confirmed, saved record removed, nothing blocked.
const ok1 = reconcile(s2[0], { status: "success", block: 42n }, T0 + 5 * 60_000)!;
assert.equal(ok1.state, "done");
s2 = update(s2, 10, ok1, T0 + 5 * 60_000);
assert.equal(toSave([], s2, tagOf(A), CHAIN, T0, tagOf).length, 0, "resolved: no longer saved");
assert.equal(blocking(s2, A).length, 0);

// Failed receipt: shown as reverted, removed from saved, and it stays on screen until closed.
const bad = reconcile({ ...s1[0], restored: true }, { status: "reverted", block: 43n }, T0 + 1000)!;
assert.equal(bad.state, "failed");
const s3 = update(s1, 10, bad, T0 + 1000);
assert.equal(toSave([], s3, tagOf(A), CHAIN, T0, tagOf).length, 0);
assert.equal(sweep(s3, T0 + 60 * 60_000)[0].shown, true);

// Saved hashes expire after a day.
assert.equal(forAccount(reloaded, tagOf(A), CHAIN, T0 + KEEP_MS + 1).length, 0);

console.log("activity ok");
