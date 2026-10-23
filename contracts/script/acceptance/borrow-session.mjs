// READ-ONLY. Journey 1: borrow, repay, withdraw collateral (5 transactions).
// Verifies each wallet transaction of the approved manifest onchain, as it lands, and stops on any deviation. It holds no keys and sends nothing.
// usage: node borrow-session.mjs run | selftest     env: WATCH_RPC (default Mezo testnet), WATCH_WAIT_BASELINE=1 (fork rehearsal)
import { execFileSync } from 'node:child_process';
const RPC = process.env.WATCH_RPC || 'https://rpc.test.mezo.org';
const CAST = process.env.CAST || 'cast'; // Foundry's cast; set CAST to its full path if it is not on PATH
const F = '0xF08043221338c621b6f2f387AF70B33797629371', MEZO = '0x7B7c000000000000000000000000000000000001', MUSD = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503';
const MO = '0xC6db4999d8428b259FD198A88d2B8E6494045A48', BOLD = '0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7', ORACLE = '0xE9a83636AcBf75eBf3b20497B8126624D4378cc5';
const ID = '0x872e50f5503b7d370ca1d782bae49df95fe39e6d7d8ae36adb0b1371eb695d3b';
const P = `(${MUSD},${MEZO},${ORACLE},0x3482E42af82B46fE9e0547A48178f2f8C8206e6A,770000000000000000)`;
const TUP = '(address,address,address,address,uint256)';
const E = 10n ** 18n, low = (s) => s.toLowerCase();
const say = (m) => console.log(`[watch ${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cast(args) { for (let i = 0; ; i++) { try { return execFileSync(CAST, [...args, '--rpc-url', RPC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { if (i >= 4) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); } } }
const call = (to, sig, ...a) => cast(['call', to, sig, ...a]);
const big = (s) => BigInt(s.split(/\s/)[0]);
const lines = (s) => s.split('\n').map((x) => BigInt(x.trim().split(/\s/)[0]));
async function rpc(method, params = []) { for (let i = 0; ; i++) { try { const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) throw new Error(r.error.message); return r.result; } catch (e) { if (i >= 4) throw e; await sleep(1500); } } }
// a load-balanced node may not have a receipt (or tx) yet even after another node mined it: that is a retry, never a verdict
async function until(method, params, tries = 20) { for (let i = 0; i < tries; i++) { const r = await rpc(method, params); if (r) return r; await sleep(3000); } throw new Error(`${method} still null after ${tries} tries; check the explorer, do not resend`); }
const calldata = (sig, ...a) => low(execFileSync(CAST, ['calldata', sig, ...a], { encoding: 'utf8' }).trim());

async function state() {
  const pos = lines(call(MO, 'position(bytes32,address)(uint256,uint128,uint128)', ID, F));
  const mk = lines(call(MO, 'market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)', ID));
  return {
    musd: big(call(MUSD, 'balanceOf(address)(uint256)', F)), mezo: big(call(MEZO, 'balanceOf(address)(uint256)', F)),
    allowMezo: big(call(MEZO, 'allowance(address,address)(uint256)', F, MO)), allowMusd: big(call(MUSD, 'allowance(address,address)(uint256)', F, MO)),
    borrowShares: pos[1], collateral: pos[2], totalBorrow: mk[2], totalBorrowShares: mk[3],
    lend: big(call(BOLD, 'seniorBalanceOf(address)(uint256)', F)), cover: big(call(BOLD, 'juniorBalanceOf(address)(uint256)', F)),
    price: big(call(ORACLE, 'price()(uint256)')), under: call(BOLD, 'isUndercovered()(bool)') === 'true',
  };
}
const m = (v, d = 4) => (Number(v) / 1e18).toFixed(d);
const show = (s) => `MEZO ${m(s.mezo, 2)} | MUSD ${m(s.musd, 4)} | collateral ${m(s.collateral, 2)} | borrow shares ${s.borrowShares} | MEZO allow ${m(s.allowMezo, 2)} | MUSD allow ${m(s.allowMusd, 4)}`;
const debtOf = (s) => (s.borrowShares === 0n ? 0n : (s.borrowShares * (s.totalBorrow + 1n)) / (s.totalBorrowShares + 1_000_000n) + 1n);

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const hasTransfer = (r, token, from, to, amt) => r.logs.some((l) => low(l.address) === low(token) && l.topics[0] === TRANSFER && low('0x' + l.topics[1].slice(26)) === low(from) && low('0x' + l.topics[2].slice(26)) === low(to) && (amt === null || BigInt(l.data) === amt(BigInt(l.data))));
const transferAmt = (r, token, from, to) => { const l = r.logs.find((x) => low(x.address) === low(token) && x.topics[0] === TRANSFER && low('0x' + x.topics[1].slice(26)) === low(from) && low('0x' + x.topics[2].slice(26)) === low(to)); return l ? BigInt(l.data) : null; };

// ---- the approved manifest: contract, exact calldata where it is known in advance, and the state each step must produce
const approveData = (spender, amt) => calldata('approve(address,uint256)', spender, amt.toString());
const STEPS = [
  { name: '1 supplyCollateral 5 MEZO', to: MO, data: () => calldata(`supplyCollateral(${TUP},uint256,address,bytes)`, P, (5n * E).toString(), F, '0x'),
    check: (pre, post, r) => [post.collateral !== pre.collateral + 5n * E && 'collateral did not rise by exactly 5', post.mezo !== pre.mezo - 5n * E && 'wallet MEZO did not fall by exactly 5', post.allowMezo !== pre.allowMezo - 5n * E && 'MEZO allowance not consumed by exactly 5', post.borrowShares !== 0n && 'debt appeared', transferAmt(r, MEZO, F, MO) !== 5n * E && 'no 5 MEZO Transfer wallet -> Morpho'] },
  { name: '2 borrow 10 MUSD', to: MO, data: () => calldata(`borrow(${TUP},uint256,uint256,address,address)`, P, (10n * E).toString(), '0', F, F),
    check: (pre, post, r) => [post.musd !== pre.musd + 10n * E && 'wallet MUSD did not rise by exactly 10', post.borrowShares !== 10n * E * 10n ** 6n && `borrow shares ${post.borrowShares}, expected 10^25`, post.collateral !== pre.collateral && 'collateral changed', transferAmt(r, MUSD, MO, F) !== 10n * E && 'no 10 MUSD Transfer Morpho -> wallet', !(debtOf(post) >= 10n * E && debtOf(post) < 10n * E + E / 100n) && `debt ${m(debtOf(post), 6)} not about 10`,
      (() => { const val = (post.collateral * post.price) / 10n ** 36n; const ltv = Number((debtOf(post) * 10_000n) / val) / 100; return !(ltv > 19.9 && ltv < 20.1) && `LTV ${ltv}% not about 20%`; })()] },
  { name: '3 approve ~10.01 MUSD to Morpho', to: MUSD, data: null,
    verifyData: (d, pre) => { const sel = d.startsWith('0x095ea7b3'), spender = low('0x' + d.slice(34, 74)) === low(MO), amt = BigInt('0x' + d.slice(74)); const owed = debtOf(pre); return [!sel && 'not an approve', !spender && 'spender is not Morpho', !(amt >= owed && amt <= owed + owed / 50n) && `amount ${m(amt, 6)} outside [debt, debt + 2%] = [${m(owed, 6)}, ${m(owed + owed / 50n, 6)}]`]; },
    check: (pre, post, r, tx) => [post.allowMusd !== BigInt('0x' + tx.input.slice(74)) && 'allowance differs from the approved amount', post.musd !== pre.musd && 'MUSD balance changed', post.borrowShares !== pre.borrowShares && 'debt changed'] },
  { name: '4 repay in full (by shares)', to: MO, data: (pre) => calldata(`repay(${TUP},uint256,uint256,address,bytes)`, P, '0', pre.borrowShares.toString(), F, '0x'),
    check: (pre, post, r) => { const paid = transferAmt(r, MUSD, F, MO); return [post.borrowShares !== 0n && 'debt not zero', post.collateral !== pre.collateral && 'collateral changed', paid === null && 'no MUSD Transfer wallet -> Morpho', paid !== null && (paid < 10n * E || paid > pre.allowMusd) && `paid ${m(paid, 8)} outside [10, allowance]`, paid !== null && post.musd !== pre.musd - paid && 'wallet MUSD != before - paid', paid !== null && post.allowMusd !== pre.allowMusd - paid && 'residual allowance != approved - paid', post.totalBorrow !== 0n && `market still has borrow ${post.totalBorrow}`]; } },
  { name: '5 withdrawCollateral 5 MEZO', to: MO, data: () => calldata(`withdrawCollateral(${TUP},uint256,address,address)`, P, (5n * E).toString(), F, F),
    check: (pre, post, r) => [post.collateral !== 0n && 'collateral not zero', post.mezo !== pre.mezo + 5n * E && 'wallet MEZO did not rise by exactly 5', transferAmt(r, MEZO, MO, F) !== 5n * E && 'no 5 MEZO Transfer Morpho -> wallet'] },
];

function verifyTx(step, tx, r, pre, post) {
  const bad = [];
  if (low(tx.from) !== low(F)) bad.push('sender is not the founder wallet');
  if (low(tx.to) !== low(step.to)) bad.push(`to ${tx.to} instead of ${step.to}`);
  if (BigInt(tx.value) !== 0n) bad.push(`value ${tx.value} is not 0`);
  if (step.data) { const want = step.data(pre); if (low(tx.input) !== want) bad.push(`calldata differs from the manifest:\n   got  ${tx.input}\n   want ${want}`); }
  if (step.verifyData) bad.push(...step.verifyData(tx.input, pre));
  if (r.status !== '0x1') bad.push('transaction REVERTED onchain');
  if (post) bad.push(...step.check(pre, post, r, tx));
  return bad.filter(Boolean);
}
function invariants(s0, s) {
  const bad = [];
  if (s.price !== s0.price) bad.push(`oracle price changed ${s0.price} -> ${s.price}`);
  if (s.under) bad.push('Bold became under-covered');
  if (s.cover < s0.cover || s.cover > s0.cover + E / 100n) bad.push(`your cover moved ${m(s0.cover, 6)} -> ${m(s.cover, 6)}`);
  if (s.lend < s0.lend || s.lend > s0.lend + E / 100n) bad.push(`your lending moved ${m(s0.lend, 6)} -> ${m(s.lend, 6)}`);
  return bad;
}
const stop = (code, msg) => { say(msg); process.exit(code); };

async function selftest() {
  const H = '0x1ffa2d7ead074c50fa90b4d13958697dca6911e02374112500ef336dc19a8e8e'; // the real Rabby approval of 5 MEZO, verified earlier
  const tx = await until('eth_getTransactionByHash', [H]), r = await until('eth_getTransactionReceipt', [H]);
  const step = { to: MEZO, data: () => approveData(MO, 5n * E) };
  const ok = verifyTx(step, tx, r, null, null);
  const wrong = verifyTx({ to: MEZO, data: () => approveData(MO, 6n * E) }, tx, r, null, null);
  const s = await state();
  say(`selftest: real approval matches manifest: ${ok.length === 0}; a wrong manifest is rejected: ${wrong.length > 0}; state read ok: MEZO ${m(s.mezo, 2)} MUSD ${m(s.musd, 2)} oracle ${s.price}`);
  process.exit(ok.length === 0 && wrong.length > 0 ? 0 : 1);
}

async function run() {
  if (BigInt(await rpc('eth_chainId')) !== 31611n) stop(2, 'DEVIATION: not chain 31611');
  say(`watching ${F} on ${RPC} (read-only)`);
  let s0, waited = 0;
  for (;;) {
    s0 = await state();
    const why = [s0.mezo !== 100n * E && `MEZO ${m(s0.mezo, 2)}`, s0.musd !== 20n * E && `MUSD ${m(s0.musd, 2)}`, s0.allowMezo !== 5n * E && `MEZO allowance ${m(s0.allowMezo, 2)}`, s0.collateral !== 0n && 'collateral present', s0.borrowShares !== 0n && 'debt present', s0.allowMusd !== 0n && 'MUSD allowance present', s0.under && 'Bold under-covered', s0.price !== 10n ** 37n && 'oracle price differs'].filter(Boolean);
    if (!why.length) break;
    if (process.env.WATCH_WAIT_BASELINE && waited < 180) { waited += 3; await sleep(3000); continue; }
    stop(2, `DEVIATION: starting state differs from the approved plan (${why.join(', ')}). Nothing to verify; stopping.`);
  }
  const n0 = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest'])));
  let head = Number(BigInt(await rpc('eth_blockNumber')));
  say(`baseline OK at block ${head}, nonce ${n0}: ${show(s0)}`);
  say('waiting for 5 wallet transactions, in this order: ' + STEPS.map((x) => x.name).join(' -> '));
  let pre = s0, k = 0, scanned = head, announced = -1; const seen = new Map(); let lastInv = Date.now();
  const deadline = Date.now() + (Number(process.env.WATCH_TIMEOUT_MIN) || 120) * 60_000;
  while (k < STEPS.length) {
    if (Date.now() > deadline) stop(3, `TIMEOUT after ${process.env.WATCH_TIMEOUT_MIN || 120} min with ${k}/5 steps verified.`);
    const latest = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest']))), pend = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'pending'])));
    if (pend > latest && announced !== latest) { announced = latest; say(`transaction broadcast, waiting for confirmation (step ${latest - n0 + 1} of 5)`); }
    if (latest > n0 + STEPS.length) stop(2, 'DEVIATION: more wallet transactions than the plan allows. Stopping.');
    if (latest > n0 + k) {
      head = Number(BigInt(await rpc('eth_blockNumber')));
      for (let b = scanned + 1; b <= head; b++) { const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); for (const t of blk?.transactions || []) if (low(t.from) === low(F)) seen.set(Number(BigInt(t.nonce)), t); }
      scanned = head;
      while (seen.has(n0 + k) && k < STEPS.length) {
        const tx = seen.get(n0 + k), step = STEPS[k];
        const r = await until('eth_getTransactionReceipt', [tx.hash]);
        const post = await state();
        const bad = verifyTx(step, tx, r, pre, post);
        if (bad.length) stop(2, `DEVIATION at step ${step.name} (tx ${tx.hash}):\n - ${bad.join('\n - ')}\nSTOP: do not sign anything further until the founder and engineering have looked at this.`);
        say(`STEP ${step.name} VERIFIED  tx ${tx.hash}  block ${Number(BigInt(tx.blockNumber))}  gas ${Number(BigInt(r.gasUsed))}\n   before: ${show(pre)}\n   after:  ${show(post)}${post.borrowShares ? ` | debt ${m(debtOf(post), 6)} MUSD` : ''}`);
        const inv = invariants(s0, post); if (inv.length) stop(2, `DEVIATION after ${step.name}: ${inv.join('; ')}`);
        pre = post; k++;
        if (k < STEPS.length) say(`next: ${STEPS[k].name}`);
      }
    }
    if (Date.now() - lastInv > 20_000) { lastInv = Date.now(); const s = await state(); const inv = invariants(s0, s); if (inv.length) stop(2, `DEVIATION: ${inv.join('; ')}`); }
    await sleep(3000);
  }
  const fin = await state();
  stop(0, `SESSION COMPLETE: all 5 transactions verified.\n   start: ${show(s0)}\n   end:   ${show(fin)}\n   MUSD interest paid: ${m(s0.musd + 10n * E - fin.musd, 8)} | residual MUSD allowance to Morpho: ${m(fin.allowMusd, 8)}`);
}
(process.argv[2] === 'selftest' ? selftest : run)().catch((e) => { console.log('[watch] ERROR (not a verdict):', e.message); process.exit(4); });
