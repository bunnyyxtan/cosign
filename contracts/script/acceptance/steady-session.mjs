// READ-ONLY. Journey 4: activate Steady with 5 MUSD of cover, then 10 MUSD of lending (4 transactions).
// Verifies each wallet transaction of the approved manifest onchain, as it lands, and stops on any deviation. It holds no keys and sends nothing.
// usage: node steady-session.mjs run | status     env: WATCH_RPC, WATCH_TIMEOUT_MIN
import { execFileSync } from 'node:child_process';
const RPC = process.env.WATCH_RPC || 'https://rpc.test.mezo.org';
const CAST = process.env.CAST || 'cast'; // Foundry's cast; set CAST to its full path if it is not on PATH
const F = '0xF08043221338c621b6f2f387AF70B33797629371', MUSD = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503';
const STEADY = '0x8f89117d71269E35D980905327e4C1252294B4a9', BOLD = '0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7';
const E = 10n ** 18n, low = (s) => s.toLowerCase();
const say = (m) => console.log(`[watch4 ${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cast(args) { for (let i = 0; ; i++) { try { return execFileSync(CAST, [...args, '--rpc-url', RPC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { if (i >= 4) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); } } }
let AT = null; // when set, every read is taken at that block
const call = (to, sig, ...a) => cast(['call', to, sig, ...a, ...(AT ? ['--block', String(AT)] : [])]);
const big = (s) => BigInt(s.split(/\s/)[0]);
async function rpc(method, params = []) { for (let i = 0; ; i++) { try { const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) throw new Error(r.error.message); return r.result; } catch (e) { if (i >= 4) throw e; await sleep(1500); } } }
async function until(method, params, tries = 20) { for (let i = 0; i < tries; i++) { const r = await rpc(method, params); if (r) return r; await sleep(3000); } throw new Error(`${method} still null after ${tries} tries; check the explorer, do not resend`); }
const calldata = (sig, ...a) => low(execFileSync(CAST, ['calldata', sig, ...a], { encoding: 'utf8' }).trim());
const m = (v, d = 6) => (Number(v) / 1e18).toFixed(d);

async function state(at = null) {
  AT = at;
  try {
    return {
      musd: big(call(MUSD, 'balanceOf(address)(uint256)', F)), allow: big(call(MUSD, 'allowance(address,address)(uint256)', F, STEADY)),
      lend: big(call(STEADY, 'seniorBalanceOf(address)(uint256)', F)), cover: big(call(STEADY, 'juniorBalanceOf(address)(uint256)', F)),
      senior: big(call(STEADY, 'seniorAssets()(uint256)')), junior: big(call(STEADY, 'juniorAssets()(uint256)')),
      cap: big(call(STEADY, 'capacity()(uint256)')), coverAssets: big(call(STEADY, 'coverAssets()(uint256)')),
      under: call(STEADY, 'isUndercovered()(bool)') === 'true', lev: big(call(STEADY, 'maxLeverage()(uint256)')),
      boldCover: big(call(BOLD, 'juniorBalanceOf(address)(uint256)', F)),
    };
  } finally { AT = null; }
}
const show = (s) => `MUSD ${m(s.musd)} | allowance→Steady ${m(s.allow)} | Steady cover ${m(s.junior)} lending ${m(s.senior)} | room to lend ${m(s.cap)} (cap ${m(s.junior * s.lev)}) | yours: cover ${m(s.cover)} lending ${m(s.lend)}`;
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const transferAmt = (r, from, to) => { const l = r.logs.find((x) => low(x.address) === low(MUSD) && x.topics[0] === TRANSFER && low('0x' + x.topics[1].slice(26)) === low(from) && low('0x' + x.topics[2].slice(26)) === low(to)); return l ? BigInt(l.data) : null; };
const approveStep = (n, amt, what) => ({
  name: `${n} approve exactly ${amt} MUSD to Steady (for ${what})`, to: MUSD, data: () => calldata('approve(address,uint256)', STEADY, (BigInt(amt) * E).toString()),
  check: (pre, post) => [post.allow !== BigInt(amt) * E && `allowance is ${m(post.allow)}, not exactly ${amt}`, post.musd !== pre.musd && 'MUSD balance changed', post.senior !== pre.senior || post.junior !== pre.junior ? 'Steady books changed' : false],
});

const STEPS = [
  approveStep(1, 5, 'cover'),
  { name: '2 depositJunior 5 MUSD (post cover on Steady)', to: STEADY, data: () => calldata('depositJunior(uint256)', (5n * E).toString()),
    check: (pre, post, r) => [post.musd !== pre.musd - 5n * E && 'wallet MUSD did not fall by exactly 5', post.allow !== 0n && 'allowance not fully used', post.cover !== 5n * E && `your Steady cover is ${m(post.cover)}, not 5`, post.junior !== 5n * E && `Steady cover total is ${m(post.junior)}, not 5`, post.cap !== 45n * E && `room to lend is ${m(post.cap)}, not 45`, post.coverAssets !== 5n * E && 'gauge-facing cover is not 5', transferAmt(r, F, STEADY) !== 5n * E && 'no 5 MUSD Transfer wallet -> Steady'] },
  approveStep(3, 10, 'lending'),
  { name: '4 depositSenior 10 MUSD (lend on Steady)', to: STEADY, data: () => calldata('depositSenior(uint256)', (10n * E).toString()),
    check: (pre, post, r) => [post.musd !== pre.musd - 10n * E && 'wallet MUSD did not fall by exactly 10', post.allow !== 0n && 'allowance not fully used', post.lend !== 10n * E && `your Steady lending is ${m(post.lend)}, not 10`, post.senior !== 10n * E && `Steady lending total is ${m(post.senior)}, not 10`, post.junior * post.lev !== 45n * E && 'total lending capacity is not 45', post.cap !== 35n * E && `room to lend is ${m(post.cap)}, not 35`, post.under && 'Steady is under-covered', transferAmt(r, F, STEADY) !== 10n * E && 'no 10 MUSD Transfer wallet -> Steady'] },
];

function verifyTx(step, tx, r, pre, post) {
  const bad = [];
  if (low(tx.from) !== low(F)) bad.push('sender is not the founder wallet');
  if (low(tx.to) !== low(step.to)) bad.push(`to ${tx.to} instead of ${step.to}`);
  if (BigInt(tx.value) !== 0n) bad.push(`value ${tx.value} is not 0`);
  const want = step.data(); if (low(tx.input) !== want) bad.push(`calldata differs from the manifest (an edited approval amount counts):\n   got  ${tx.input}\n   want ${want}`);
  if (r.status !== '0x1') bad.push('transaction REVERTED onchain');
  bad.push(...step.check(pre, post, r));
  return bad.filter(Boolean);
}
const stop = (code, msg) => { say(msg); process.exit(code); };

async function run() {
  if (BigInt(await rpc('eth_chainId')) !== 31611n) stop(2, 'DEVIATION: not chain 31611');
  say(`watching ${F} on ${RPC} (read-only)`);
  const s0 = await state();
  const why = [s0.musd < 15n * E && `MUSD ${m(s0.musd)} is below the 15 needed`, s0.allow !== 0n && 'an MUSD allowance to Steady is already present', s0.senior !== 0n && 'Steady already has lending', s0.junior !== 0n && 'Steady already has cover', s0.lev !== 9n && `Steady leverage is ${s0.lev}, not 9`].filter(Boolean);
  if (why.length) stop(2, `DEVIATION: starting state differs from the approved plan (${why.join(', ')}). Nothing to verify; stopping.`);
  const n0 = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest']))), p0 = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'pending'])));
  if (p0 !== n0) stop(2, `DEVIATION: ${p0 - n0} transaction(s) already pending from the wallet`);
  let head = Number(BigInt(await rpc('eth_blockNumber')));
  say(`baseline OK at block ${head}, nonce ${n0}: ${show(s0)}`);
  say('waiting for 4 wallet transactions, one at a time, in this order:\n   ' + STEPS.map((x) => x.name).join('\n   '));
  let pre = s0, k = 0, scanned = head, announced = -1; const seen = new Map();
  const deadline = Date.now() + (Number(process.env.WATCH_TIMEOUT_MIN) || 180) * 60_000;
  while (k < STEPS.length) {
    if (Date.now() > deadline) stop(3, `TIMEOUT with ${k}/${STEPS.length} steps verified.`);
    const latest = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest']))), pend = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'pending'])));
    if (pend > latest && announced !== latest) { announced = latest; say(`transaction broadcast, waiting for confirmation (step ${latest - n0 + 1})`); }
    if (pend > latest + 1) stop(2, 'DEVIATION: more than one transaction in flight; the plan is one at a time. Stopping.');
    if (latest > n0 + STEPS.length) stop(2, 'DEVIATION: more wallet transactions than the plan allows. Stopping.');
    if (latest > n0 + k) {
      head = Number(BigInt(await rpc('eth_blockNumber')));
      for (let b = scanned + 1; b <= head; b++) { const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); for (const t of blk?.transactions || []) if (low(t.from) === low(F)) seen.set(Number(BigInt(t.nonce)), t); }
      scanned = head;
      while (seen.has(n0 + k) && k < STEPS.length) {
        const tx = seen.get(n0 + k), step = STEPS[k];
        const r = await until('eth_getTransactionReceipt', [tx.hash]);
        const post = await state(Number(BigInt(tx.blockNumber)));
        const bad = verifyTx(step, tx, r, pre, post);
        if (bad.length) stop(2, `DEVIATION at step ${step.name} (tx ${tx.hash}):\n - ${bad.join('\n - ')}\nSTOP: do not sign anything further until the founder and engineering have looked at this.`);
        say(`STEP ${step.name} VERIFIED  tx ${tx.hash}  block ${Number(BigInt(tx.blockNumber))}  gas ${Number(BigInt(r.gasUsed))}\n   before: ${show(pre)}\n   after:  ${show(post)}`);
        if (post.boldCover !== s0.boldCover) stop(2, 'DEVIATION: Bold cover changed');
        pre = post; k++;
        if (k < STEPS.length) say(`next: ${STEPS[k].name}`);
      }
    }
    await sleep(3000);
  }
  const fin = await state();
  stop(0, `SESSION COMPLETE (${k}/${STEPS.length} steps).\n   start: ${show(s0)}\n   end:   ${show(fin)}`);
}
const status = async () => say(show(await state()));
(process.argv[2] === 'status' ? status : run)().catch((e) => { console.log('[watch4] ERROR (not a verdict):', e.message); process.exit(4); });
