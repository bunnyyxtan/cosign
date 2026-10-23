// node scripts/check-activity.ts — asserts the transaction-notice rules: what stays, what hides itself, and when.
import assert from "node:assert/strict";
import { add, dismiss, explain, inFlight, isOpen, lifetime, mine, sweep, toasts, update, type TxItem } from "../src/app/activity.ts";

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
console.log("activity ok");
