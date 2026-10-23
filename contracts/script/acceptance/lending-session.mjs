// READ-ONLY. Journey 2: lender deposit and withdrawals, partial cover withdrawal (6 transactions).
// Verifies each wallet transaction of the approved manifest onchain, as it lands, and stops on any deviation. It holds no keys and sends nothing.
// usage: node lending-session.mjs run | selftest     env: WATCH_RPC, WATCH_TIMEOUT_MIN, WATCH_WAIT_BASELINE=1 (fork rehearsal)
import { execFileSync } from 'node:child_process';
const RPC = process.env.WATCH_RPC || 'https://rpc.test.mezo.org';
const CAST = process.env.CAST || 'cast'; // Foundry's cast; set CAST to its full path if it is not on PATH
const F = '0xF08043221338c621b6f2f387AF70B33797629371', MUSD = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503', MO = '0xC6db4999d8428b259FD198A88d2B8E6494045A48';
const BOLD = '0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7', ORACLE = '0xE9a83636AcBf75eBf3b20497B8126624D4378cc5';
const ID = '0x872e50f5503b7d370ca1d782bae49df95fe39e6d7d8ae36adb0b1371eb695d3b';
const E = 10n ** 18n, low = (s) => s.toLowerCase(), TOL = 10n ** 13n; // 1e-5 MUSD tolerance for interest accrued between two reads
const say = (m) => console.log(`[watch2 ${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cast(args) { for (let i = 0; ; i++) { try { return execFileSync(CAST, [...args, '--rpc-url', RPC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { if (i >= 4) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); } } }
let AT = null; // when set, every read is taken at that block, so a later transaction cannot contaminate a step's "after" state
const call = (to, sig, ...a) => cast(['call', to, sig, ...a, ...(AT ? ['--block', String(AT)] : [])]);
const big = (s) => BigInt(s.split(/\s/)[0]);
const nums = (s) => s.split('\n').map((x) => BigInt(x.trim().split(/\s/)[0]));
async function rpc(method, params = []) { for (let i = 0; ; i++) { try { const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) throw new Error(r.error.message); return r.result; } catch (e) { if (i >= 4) throw e; await sleep(1500); } } }
// a load-balanced node may lack a receipt or tx that another node mined: retry, never treat it as a verdict
async function until(method, params, tries = 20) { for (let i = 0; i < tries; i++) { const r = await rpc(method, params); if (r) return r; await sleep(3000); } throw new Error(`${method} still null after ${tries} tries; check the explorer, do not resend`); }
const calldata = (sig, ...a) => low(execFileSync(CAST, ['calldata', sig, ...a], { encoding: 'utf8' }).trim());
const m = (v, d = 4) => (Number(v) / 1e18).toFixed(d);
const near = (a, b, tol = TOL) => (a > b ? a - b : b - a) <= tol;

async function state(at = null) {
  AT = at; try { return await readState(); } finally { AT = null; }
}
async function readState() {
  const req = nums(call(BOLD, 'withdrawRequests(address)(uint64,uint64,uint256)', F)), pos = nums(call(MO, 'position(bytes32,address)(uint256,uint128,uint128)', ID, F)), mk = nums(call(MO, 'market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)', ID));
  return {
    musd: big(call(MUSD, 'balanceOf(address)(uint256)', F)), allow: big(call(MUSD, 'allowance(address,address)(uint256)', F, BOLD)),
    sShares: big(call(BOLD, 'seniorShares(address)(uint256)', F)), lend: big(call(BOLD, 'seniorBalanceOf(address)(uint256)', F)),
    jShares: big(call(BOLD, 'juniorSharesOf(address)(uint256)', F)), cover: big(call(BOLD, 'juniorBalanceOf(address)(uint256)', F)),
    req: { round: req[0], readyAt: req[1], shares: req[2] }, round: big(call(BOLD, 'juniorRound()(uint64)')),
    bSenior: big(call(BOLD, 'seniorAssets()(uint256)')), bJunior: big(call(BOLD, 'juniorAssets()(uint256)')), tJShares: big(call(BOLD, 'totalJuniorShares()(uint256)')),
    under: call(BOLD, 'isUndercovered()(bool)') === 'true', price: big(call(ORACLE, 'price()(uint256)')),
    collateral: pos[2], borrowShares: pos[1], totalBorrow: mk[2],
  };
}
const show = (s) => `MUSD ${m(s.musd, 4)} | MUSD allow→Bold ${m(s.allow, 4)} | lending ${m(s.lend, 6)} | cover ${m(s.cover, 6)} | request ${s.req.shares ? m(s.req.shares / 10n ** 6n, 4) + 'e6 shares' : 'none'} | Bold lenders ${m(s.bSenior, 4)} cover ${m(s.bJunior, 4)}`;
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const transferAmt = (r, token, from, to) => { const l = r.logs.find((x) => low(x.address) === low(token) && x.topics[0] === TRANSFER && low('0x' + x.topics[1].slice(26)) === low(from) && low('0x' + x.topics[2].slice(26)) === low(to)); return l ? BigInt(l.data) : null; };
const argOf = (d) => BigInt('0x' + d.slice(10, 74));
const needCover = (s) => -(-s.bSenior / 19n) * 1n; // senior / maxLeverage, rounded up
const coverNeeded = (senior) => (senior + 18n) / 19n;
const sharesNear = (got, want, rel = 100_000n) => near(got, want, want / rel + 1n);
const assetsOf = (shares, s) => (shares * (s.bJunior + 1n)) / (s.tJShares + 1_000_000n);

const ALL_STEPS = [
  { name: '1 approve MUSD to Bold, cap lowered to 1 MUSD', to: MUSD, verifyData: (d) => [!d.startsWith('0x095ea7b3') && 'not an approve', low('0x' + d.slice(34, 74)) !== low(BOLD) && 'spender is not the Bold vault', ![E, 2n * E].includes(BigInt('0x' + d.slice(74))) && `amount ${m(BigInt('0x' + d.slice(74)), 4)} MUSD; expected exactly 1 (the lowered cap) or, if Rabby cannot edit it, 2`],
    note: (pre, post, r, tx) => (BigInt('0x' + tx.input.slice(74)) === E ? 'B2 EXERCISED: the allowance was lowered to exactly 1 MUSD' : 'FALLBACK: 2 MUSD was approved, the cap was NOT lowered, so B2 (allowance too low) was NOT exercised; 1 MUSD of allowance will remain after step 2'),
    check: (pre, post, r, tx) => [post.allow !== BigInt('0x' + tx.input.slice(74)) && 'allowance differs from the approved amount', post.musd !== pre.musd && 'MUSD balance changed', post.sShares !== pre.sShares && 'a deposit happened'] },
  { name: '2 depositSenior 1 MUSD (uses the 1 MUSD allowance)', to: BOLD, data: () => calldata('depositSenior(uint256)', E.toString()),
    check: (pre, post, r) => [post.musd !== pre.musd - E && 'wallet MUSD did not fall by exactly 1', post.allow !== pre.allow - E && 'allowance did not fall by exactly 1', !near(post.lend, pre.lend + E) && `lending ${m(post.lend, 8)} is not before + 1`, transferAmt(r, MUSD, F, BOLD) !== E && 'no 1 MUSD Transfer wallet -> vault', post.sShares <= pre.sShares && 'no lender shares minted'] },
  { name: '3 withdrawSenior, about 4 MUSD (partial)', to: BOLD,
    verifyData: (d, pre) => { const s = argOf(d), want = (4n * E * pre.sShares) / pre.lend; return [!d.startsWith('0x875382e5') && 'not withdrawSenior(uint256)', !sharesNear(s, want) && `shares ${s} differ from the 4 MUSD amount ${want} by more than 0.001%`]; },
    check: (pre, post, r, tx) => { const s = argOf(tx.input), got = post.musd - pre.musd; return [!near(got, 4n * E) && `wallet MUSD rose by ${m(got, 8)}, expected about 4`, post.sShares !== pre.sShares - s && 'lender shares did not fall by the shares withdrawn', !near(pre.lend - post.lend, got) && 'lending did not fall by the amount received', post.sShares === 0n && 'this was meant to be a partial withdrawal', transferAmt(r, MUSD, MO, F) === null && 'no MUSD Transfer Morpho -> wallet (the vault has Morpho pay the receiver directly)']; } },
  { name: '4 withdrawSenior, all remaining lending', to: BOLD,
    verifyData: (d, pre) => [!d.startsWith('0x875382e5') && 'not withdrawSenior(uint256)', argOf(d) !== pre.sShares && `shares ${argOf(d)} are not the whole position ${pre.sShares}`],
    check: (pre, post) => { const got = post.musd - pre.musd; return [post.sShares !== 0n && 'lender shares not zero', post.lend !== 0n && post.lend > 1n && `lending left ${post.lend}`, !near(got, pre.lend) && `wallet MUSD rose by ${m(got, 8)}, expected about ${m(pre.lend, 8)}`, !near(pre.bSenior - post.bSenior, got) && 'Bold lender total did not fall by the amount']; } },
  { name: '5 requestJuniorWithdraw, about 5 MUSD of cover', to: BOLD, ctx: true,
    verifyData: (d, pre) => { const s = argOf(d), want = (5n * E * pre.jShares) / pre.cover; return [!d.startsWith('0xa9ee19c4') && 'not requestJuniorWithdraw(uint256)', !sharesNear(s, want) && `shares ${s} differ from the 5 MUSD amount ${want} by more than 0.001%`, assetsOf(s, pre) > pre.bJunior - coverNeeded(pre.bSenior) && 'more than the cover that may leave now (the app should have refused this)']; },
    check: (pre, post, r, tx, ctx) => { const s = argOf(tx.input); return [post.req.shares !== s && 'onchain request does not hold the requested shares', post.req.round !== post.round && 'request is for another round', !(post.req.readyAt - ctx.ts >= 595n && post.req.readyAt - ctx.ts <= 605n) && `ready in ${post.req.readyAt - ctx.ts}s, expected the 10-minute notice (600)`, post.musd !== pre.musd && 'MUSD changed (a request moves nothing)', !near(post.cover, pre.cover) && 'cover changed']; } },
  { name: '6 withdrawJunior, after the 10-minute notice', to: BOLD, ctx: true, data: () => calldata('withdrawJunior()'),
    check: (pre, post, r, tx, ctx) => { const want = assetsOf(pre.req.shares, pre), got = post.musd - pre.musd; return [ctx.ts < pre.req.readyAt && `sent ${pre.req.readyAt - ctx.ts}s before the notice ended`, post.req.shares !== 0n && 'request not cleared', post.jShares !== pre.jShares - pre.req.shares && 'cover shares did not fall by the requested shares', !near(got, want) && `wallet MUSD rose by ${m(got, 8)}, expected about ${m(want, 8)}`, post.under && 'Bold became under-covered', post.bJunior < coverNeeded(post.bSenior) && 'cover fell below the minimum', transferAmt(r, MUSD, MO, F) === null && 'no MUSD Transfer Morpho -> wallet (the vault has Morpho pay the receiver directly)']; } },
  { name: '7 requestJuniorWithdraw, about 0.1 MUSD, left unused to observe expiry (optional)', to: BOLD, optional: true, ctx: true,
    verifyData: (d, pre) => { const s = argOf(d), want = (E / 10n * pre.jShares) / pre.cover; return [!d.startsWith('0xa9ee19c4') && 'not requestJuniorWithdraw(uint256)', !sharesNear(s, want) && `shares ${s} differ from the 0.1 MUSD amount ${want}`]; },
    check: (pre, post, r, tx, ctx) => [post.req.shares !== argOf(tx.input) && 'onchain request does not hold the requested shares', post.musd !== pre.musd && 'MUSD changed'] },
];

const STEPS = ALL_STEPS.filter((x) => !(process.env.WATCH_SKIP7 && x.optional));

function verifyTx(step, tx, r, pre, post, ctx) {
  const bad = [];
  if (low(tx.from) !== low(F)) bad.push('sender is not the founder wallet');
  if (low(tx.to) !== low(step.to)) bad.push(`to ${tx.to} instead of ${step.to}`);
  if (BigInt(tx.value) !== 0n) bad.push(`value ${tx.value} is not 0`);
  if (step.data) { const want = step.data(pre); if (low(tx.input) !== want) bad.push(`calldata differs from the manifest:\n   got  ${tx.input}\n   want ${want}`); }
  if (step.verifyData) bad.push(...step.verifyData(tx.input, pre));
  if (r.status !== '0x1') bad.push('transaction REVERTED onchain');
  if (post) bad.push(...step.check(pre, post, r, tx, ctx));
  return bad.filter(Boolean);
}
function invariants(s0, s) {
  const bad = [];
  if (s.price !== s0.price) bad.push(`oracle price changed ${s0.price} -> ${s.price}`);
  if (s.under) bad.push('Bold became under-covered');
  if (s.collateral !== 0n || s.borrowShares !== 0n) bad.push('a Morpho borrow position appeared');
  if (s.totalBorrow !== 0n) bad.push('the market has borrowing');
  return bad;
}
const stop = (code, msg) => { say(msg); process.exit(code); };

async function selftest() {
  const H = '0x128ccab0c6c399aefeae82be615e199c7651d19bf876d097d579c4af6e2276c8'; // the real Rabby depositSenior of 10 MUSD
  const tx = await until('eth_getTransactionByHash', [H]), r = await until('eth_getTransactionReceipt', [H]);
  const ok = verifyTx({ to: BOLD, data: () => calldata('depositSenior(uint256)', (10n * E).toString()) }, tx, r, null, null, null);
  const wrong = verifyTx({ to: BOLD, data: () => calldata('depositSenior(uint256)', E.toString()) }, tx, r, null, null, null);
  const s = await state();
  say(`selftest: real 10 MUSD deposit matches its manifest: ${ok.length === 0}; a wrong amount is rejected: ${wrong.length > 0}; state read ok: MUSD ${m(s.musd, 4)} lending ${m(s.lend, 6)} cover ${m(s.cover, 6)} oracle ${s.price}`);
  process.exit(ok.length === 0 && wrong.length > 0 ? 0 : 1);
}

async function run() {
  if (BigInt(await rpc('eth_chainId')) !== 31611n) stop(2, 'DEVIATION: not chain 31611');
  say(`watching ${F} on ${RPC} (read-only)`);
  let s0, waited = 0;
  for (;;) {
    s0 = await state();
    const why = [!near(s0.musd, 20n * E, E / 10n) && `MUSD ${m(s0.musd, 4)}`, s0.allow !== 0n && 'MUSD allowance to Bold present', !near(s0.lend, 10n * E, E / 100n) && `lending ${m(s0.lend, 4)}`, !near(s0.cover, 20n * E, E / 100n) && `cover ${m(s0.cover, 4)}`, s0.req.shares !== 0n && 'a withdrawal request is already live', s0.collateral !== 0n && 'collateral present', s0.borrowShares !== 0n && 'debt present', s0.under && 'Bold under-covered', s0.price !== 10n ** 37n && 'oracle price differs'].filter(Boolean);
    if (!why.length) break;
    if (process.env.WATCH_WAIT_BASELINE && waited < 180) { waited += 3; await sleep(3000); continue; }
    stop(2, `DEVIATION: starting state differs from the approved plan (${why.join(', ')}). Nothing to verify; stopping.`);
  }
  const n0 = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest'])));
  let head = Number(BigInt(await rpc('eth_blockNumber')));
  say(`baseline OK at block ${head}, nonce ${n0}: ${show(s0)}`);
  say('waiting for up to 7 wallet transactions, in this order:\n   ' + STEPS.map((x) => x.name).join('\n   '));
  let pre = s0, k = 0, scanned = head, announced = -1, tail = null, lastRecheck = 0, lastLine = ''; const seen = new Map(); let lastInv = Date.now();
  const required = STEPS.filter((x) => !x.optional).length;
  const deadline = Date.now() + (Number(process.env.WATCH_TIMEOUT_MIN) || 180) * 60_000;
  while (k < STEPS.length) {
    if (Date.now() > deadline) stop(3, `TIMEOUT with ${k}/${required} required steps verified.`);
    if (k >= required && !tail) tail = Date.now() + 20 * 60_000;
    if (tail && Date.now() > tail) break; // the optional last step was not taken
    const latest = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest']))), pend = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'pending'])));
    if (pend > latest && announced !== latest) { announced = latest; say(`transaction broadcast, waiting for confirmation (step ${latest - n0 + 1})`); }
    if (latest > n0 + STEPS.length) stop(2, 'DEVIATION: more wallet transactions than the plan allows. Stopping.');
    if (latest > n0 + k) {
      head = Number(BigInt(await rpc('eth_blockNumber')));
      for (let b = scanned + 1; b <= head; b++) { const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); for (const t of blk?.transactions || []) if (low(t.from) === low(F)) seen.set(Number(BigInt(t.nonce)), { t, ts: BigInt(blk.timestamp) }); }
      scanned = head;
      while (seen.has(n0 + k) && k < STEPS.length) {
        const { t: tx, ts } = seen.get(n0 + k), step = STEPS[k];
        const r = await until('eth_getTransactionReceipt', [tx.hash]);
        const post = await state(Number(BigInt(tx.blockNumber)));
        const bad = verifyTx(step, tx, r, pre, post, { ts });
        if (bad.length) stop(2, `DEVIATION at step ${step.name} (tx ${tx.hash}):\n - ${bad.join('\n - ')}\nSTOP: do not sign anything further until the founder and engineering have looked at this.`);
        say(`STEP ${step.name} VERIFIED  tx ${tx.hash}  block ${Number(BigInt(tx.blockNumber))}  gas ${Number(BigInt(r.gasUsed))}\n   before: ${show(pre)}\n   after:  ${show(post)}${step.note ? '\n   NOTE: ' + step.note(pre, post, r, tx) : ''}`);
        const inv = invariants(s0, post); if (inv.length) stop(2, `DEVIATION after ${step.name}: ${inv.join('; ')}`);
        pre = post; k++;
        if (k < STEPS.length) say(`next: ${STEPS[k].name}${k === 5 ? ' (the notice ends at ' + new Date(Number(pre.req.readyAt) * 1000).toLocaleTimeString() + ')' : ''}`);
      }
    }
    if (k === 5 && Date.now() - lastRecheck > 20_000) {
      lastRecheck = Date.now();
      const st = await state(), now = BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp);
      const ready = now >= st.req.readyAt, free = st.bJunior - coverNeeded(st.bSenior), want = assetsOf(st.req.shares, st);
      let sim; try { sim = 'would succeed, returns ' + m(big(call(BOLD, 'withdrawJunior()(uint256)', '--from', F)), 6) + ' MUSD'; } catch (e) { sim = 'would FAIL: ' + String(e.stderr || e.message).split('\n')[0].slice(0, 90); }
      const verdict = ready && want <= free && sim.startsWith('would succeed') ? 'OK to sign' : 'NOT yet safe to sign';
      const line = `RECHECK before step 6: ${ready ? 'notice ended' : 'notice ends in ' + (st.req.readyAt - now) + 's'}; requested ${m(want, 4)} MUSD; cover that may leave now ${m(free, 4)}; vault simulation ${sim} => ${verdict}`;
      if (line.replace(/in \d+s/, '') !== lastLine) { lastLine = line.replace(/in \d+s/, ''); say(line); }
    }
    if (Date.now() - lastInv > 20_000) { lastInv = Date.now(); const s = await state(); const inv = invariants(s0, s); if (inv.length) stop(2, `DEVIATION: ${inv.join('; ')}`); }
    await sleep(3000);
  }
  const fin = await state();
  stop(0, `SESSION COMPLETE (${k}/${STEPS.length} steps${k < STEPS.length ? '; the optional step 7 was not taken' : ''}).\n   start: ${show(s0)}\n   end:   ${show(fin)}\n   wallet MUSD ${m(s0.musd, 6)} -> ${m(fin.musd, 6)} | lending ${m(s0.lend, 6)} -> ${m(fin.lend, 6)} | cover ${m(s0.cover, 6)} -> ${m(fin.cover, 6)}`);
}
(process.argv[2] === 'selftest' ? selftest : run)().catch((e) => { console.log('[watch2] ERROR (not a verdict):', e.message); process.exit(4); });
