// READ-ONLY. Journey 3: veBTC lock, vote, fund, distribute, claim (7 transactions).
// Verifies each wallet transaction of the approved manifest onchain, as it lands, and stops on any deviation. It holds no keys and sends nothing.
// usage: node rewards-session.mjs run | selftest
// env: WATCH_RPC, WATCH_TIMEOUT_MIN, WATCH_WAIT_BASELINE=1 (fork rehearsal), WATCH_TOKEN=<id> (rehearsal: skip the lock, vote with this position)
import { execFileSync } from 'node:child_process';
const RPC = process.env.WATCH_RPC || 'https://rpc.test.mezo.org';
const CAST = process.env.CAST || 'cast'; // Foundry's cast; set CAST to its full path if it is not on PATH
const F = '0xF08043221338c621b6f2f387AF70B33797629371', MEZO = '0x7B7c000000000000000000000000000000000001', BTC = '0x7b7C000000000000000000000000000000000000';
const VE = '0xB63fcCd03521Cf21907627bd7fA465C129479231', G = '0x67e8De42E32000B703Cf95c05009eE757F325b11', BOLD = '0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7', STEADY = '0x8f89117d71269E35D980905327e4C1252294B4a9';
const MUSD = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503', ORACLE = '0xE9a83636AcBf75eBf3b20497B8126624D4378cc5', MO = '0xC6db4999d8428b259FD198A88d2B8E6494045A48';
const ID = '0x872e50f5503b7d370ca1d782bae49df95fe39e6d7d8ae36adb0b1371eb695d3b';
const E = 10n ** 18n, LOCK = E / 1000n, FUND = 2n * E, DAY = 86400n, low = (s) => s.toLowerCase();
const REHEARSAL_TOKEN = process.env.WATCH_TOKEN ? BigInt(process.env.WATCH_TOKEN) : null;
const say = (m) => console.log(`[watch3 ${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cast(args) { for (let i = 0; ; i++) { try { return execFileSync(CAST, [...args, '--rpc-url', RPC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { if (i >= 4) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); } } }
let AT = null; // reads at a step's own block, so later transactions cannot contaminate its "after" state
const blk = () => (AT ? ['--block', String(AT)] : []);
const call = (to, sig, ...a) => cast(['call', to, sig, ...a, ...blk()]);
const big = (s) => BigInt(s.split(/\s/)[0]);
const nums = (s) => s.split('\n').map((x) => BigInt(x.trim().split(/\s/)[0]));
async function rpc(method, params = []) { for (let i = 0; ; i++) { try { const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) throw new Error(r.error.message); return r.result; } catch (e) { if (i >= 4) throw e; await sleep(1500); } } }
async function until(method, params, tries = 20) { for (let i = 0; i < tries; i++) { const r = await rpc(method, params); if (r) return r; await sleep(3000); } throw new Error(`${method} still null after ${tries} tries; check the explorer, do not resend`); }
const calldata = (sig, ...a) => low(execFileSync(CAST, ['calldata', sig, ...a], { encoding: 'utf8' }).trim());
const m = (v, d = 4) => (Number(v) / 1e18).toFixed(d);
const near = (a, b, tol) => (a > b ? a - b : b - a) <= tol;
const argAt = (d, i) => BigInt('0x' + d.slice(10 + 64 * i, 74 + 64 * i));
const addrAt = (d, i) => '0x' + d.slice(10 + 64 * i + 24, 74 + 64 * i);
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const transferAmt = (r, token, from, to) => { const l = r.logs.find((x) => low(x.address) === low(token) && x.topics[0] === TRANSFER && low('0x' + x.topics[1].slice(26)) === low(from) && low('0x' + x.topics[2].slice(26)) === low(to)); return l ? BigInt(l.data) : null; };

let GENESIS = 0n, EPLEN = 600n;
async function state(at = null) {
  AT = at; try { return await readState(); } finally { AT = null; }
}
async function readState() {
  const pos = nums(call(MO, 'position(bytes32,address)(uint256,uint128,uint128)', ID, F)), nft = big(call(VE, 'balanceOf(address)(uint256)', F));
  const ids = []; for (let i = 0n; i < nft && i < 4n; i++) ids.push(big(call(VE, 'ownerToNFTokenIdList(address,uint256)(uint256)', F, String(i))));
  const epoch = big(call(G, 'currentEpoch()(uint256)'));
  // rehearsal only: a fork cannot run the BTC precompile, so its allowance read may fail there; the real chain is read strictly
  return {
    musd: big(call(MUSD, 'balanceOf(address)(uint256)', F)), mezo: big(call(MEZO, 'balanceOf(address)(uint256)', F)),
    btc: big(cast(['balance', F, ...blk()])), allowBtc: REHEARSAL_TOKEN !== null ? (() => { try { return big(execFileSync(CAST, ['call', BTC, 'allowance(address,address)(uint256)', F, VE, '--rpc-url', RPC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()); } catch { return 0n; } })() : big(call(BTC, 'allowance(address,address)(uint256)', F, VE)), allowMezo: big(call(MEZO, 'allowance(address,address)(uint256)', F, G)),
    nft, ids, cover: big(call(BOLD, 'juniorBalanceOf(address)(uint256)', F)), jShares: big(call(BOLD, 'juniorSharesOf(address)(uint256)', F)), tJShares: big(call(BOLD, 'totalJuniorShares()(uint256)')),
    epoch, budget: big(call(G, 'epochBudget(uint256)(uint256)', String(epoch))), gaugeMezo: big(call(MEZO, 'balanceOf(address)(uint256)', G)), boldMezo: big(call(MEZO, 'balanceOf(address)(uint256)', BOLD)),
    votesBold: big(call(G, 'vaultVotes(address)(uint256)', BOLD)), weightBold: big(call(G, 'weightOf(address)(uint256)', BOLD)), pending: big(call(BOLD, 'pendingRewards(address)(uint256)', F)),
    under: call(BOLD, 'isUndercovered()(bool)') === 'true', price: big(call(ORACLE, 'price()(uint256)')), collateral: pos[2], borrowShares: pos[1],
  };
}
const show = (s) => `BTC ${m(s.btc, 6)} | MEZO ${m(s.mezo, 4)} | veBTC positions ${s.ids.length ? '#' + s.ids.join(',#') : 'none'} | cover ${m(s.cover, 4)} | epoch ${s.epoch} budget ${m(s.budget, 2)} | Bold MEZO ${m(s.boldMezo, 4)} | claimable ${m(s.pending, 6)}`;
const stepCtx = { fundEpoch: null, distTs: null, token: REHEARSAL_TOKEN, lockEnd: null };

const STEPS = [
  { name: '1 BTC approve to veBTC, 0.001 BTC', to: BTC, lock: true,
    verifyData: (d) => [!d.startsWith('0x095ea7b3') && 'not an approve', low(addrAt(d, 0)) !== low(VE) && 'spender is not veBTC', !(argAt(d, 1) >= LOCK && argAt(d, 1) <= 2n * LOCK) && `amount ${m(argAt(d, 1), 6)} BTC; expected 0.001 (at most 0.002); an unlimited approval is not in the manifest`],
    check: (pre, post, r, tx) => [post.allowBtc !== argAt(tx.input, 1) && 'BTC allowance differs from the approved amount', post.ids.length !== pre.ids.length && 'a lock appeared'] },
  { name: '2 veBTC createLock, 0.001 BTC for about 4 weeks', to: VE, lock: true, ctx: true,
    verifyData: (d) => [!(d.startsWith(calldata('createLock(uint256,uint256)', '1', '1').slice(0, 10))) && 'not createLock(uint256,uint256)', argAt(d, 0) !== LOCK && `locks ${m(argAt(d, 0), 6)} BTC, expected 0.001`, !(argAt(d, 1) >= 7n * DAY && argAt(d, 1) <= 33n * DAY) && `duration ${Number(argAt(d, 1)) / 86400} days outside the 7 to 33 days the contract accepts`],
    check: (pre, post, r, tx, ctx) => {
      const id = post.ids.find((i) => !pre.ids.includes(i)); stepCtx.token = id ?? null;
      const lk = id !== undefined ? nums(call(VE, 'locked(uint256)(int128,uint256)', String(id))) : null; if (lk) stepCtx.lockEnd = lk[1];
      return [id === undefined && 'no new veBTC position appeared in the wallet', lk && lk[0] !== LOCK && `locked amount ${m(lk[0], 6)}`, lk && !(lk[1] > ctx.ts && lk[1] <= ctx.ts + 34n * DAY) && 'lock end outside the expected range', !near(pre.btc - post.btc, LOCK, 10n ** 14n) && `BTC fell by ${m(pre.btc - post.btc, 8)}, expected 0.001 plus gas`, id !== undefined && big(call(VE, 'balanceOfNFT(uint256)(uint256)', String(id))) === 0n && 'the new position has no voting power'];
    },
    note: (pre, post) => `new veBTC position #${stepCtx.token}, unlocks ${new Date(Number(stepCtx.lockEnd) * 1000).toISOString().slice(0, 16)} UTC, voting power ${m(big(call(VE, 'balanceOfNFT(uint256)(uint256)', String(stepCtx.token))), 6)}; it cannot be withdrawn before then` },
  { name: '3 gauge.vote(position, [Bold], [100])', to: G, data: () => calldata('vote(uint256,address[],uint256[])', String(stepCtx.token), `[${BOLD}]`, '[100]'),
    check: (pre, post, r, tx, ctx) => { const t = stepCtx.token, tv = big(call(G, 'tokenVotes(uint256,address)(uint256)', String(t), BOLD)), pw = big(call(VE, 'balanceOfNFT(uint256)(uint256)', String(t))); return [low(call(G, 'voterOf(uint256)(address)', String(t))) !== low(F) && 'the founder is not recorded as the voter', !near(tv, pw, 10n ** 11n) && `votes for Bold ${tv} differ from the position's power ${pw}`, big(call(G, 'lastVotedEpochPlusOne(uint256)(uint256)', String(t))) !== post.epoch + 1n && 'vote not recorded for this epoch', REHEARSAL_TOKEN === null && post.votesBold <= pre.votesBold && 'Bold vote total did not rise (a fresh position adds votes; the rehearsal reuses one that had old votes)', post.weightBold !== pre.weightBold && post.weightBold > big(call(G, 'coverCap(address)(uint256)', BOLD)) && 'Bold weight exceeds its cover cap', post.cover !== pre.cover && 'cover changed']; },
    note: (pre, post) => `Bold votes ${pre.votesBold} -> ${post.votesBold}; weight ${post.weightBold} (capped by cover ${big(call(G, 'coverCap(address)(uint256)', BOLD))})` },
  { name: '4 MEZO approve to the gauge, exactly 2 MEZO', to: MEZO, data: () => calldata('approve(address,uint256)', G, FUND), check: (pre, post) => [post.allowMezo !== FUND && 'allowance is not exactly 2 MEZO', post.mezo !== pre.mezo && 'MEZO balance changed'] },
  { name: '5 gauge.fund(2 MEZO)', to: G, ctx: true, data: () => calldata('fund(uint256)', FUND),
    check: (pre, post, r, tx, ctx) => { stepCtx.fundEpoch = (ctx.ts - GENESIS) / EPLEN; const fe = stepCtx.fundEpoch, before = big(call(G, 'epochBudget(uint256)(uint256)', String(fe), '--block', String(Number(ctx.block) - 1))); return [post.mezo !== pre.mezo - FUND && 'wallet MEZO did not fall by exactly 2', post.allowMezo !== 0n && 'allowance not consumed', post.gaugeMezo !== pre.gaugeMezo + FUND && 'gauge did not receive exactly 2 MEZO', big(call(G, 'epochBudget(uint256)(uint256)', String(fe))) !== before + FUND && `epoch ${fe} budget did not rise by exactly 2`, transferAmt(r, MEZO, F, G) !== FUND && 'no 2 MEZO Transfer wallet -> gauge']; },
    note: () => `funded epoch ${stepCtx.fundEpoch}; it can be distributed once that epoch is over` },
  { name: '6 gauge.distribute(the funded epoch)', to: G, ctx: true, data: () => calldata('distribute(uint256)', String(stepCtx.fundEpoch)),
    check: (pre, post, r, tx, ctx) => { stepCtx.distTs = ctx.ts; return [ctx.ts < GENESIS + (stepCtx.fundEpoch + 1n) * EPLEN && 'sent before the epoch ended', call(G, 'distributed(uint256)(bool)', String(stepCtx.fundEpoch)) !== 'true' && 'epoch not marked distributed', post.gaugeMezo !== pre.gaugeMezo - FUND && 'the gauge did not pay out the 2 MEZO', post.boldMezo !== pre.boldMezo + FUND && 'Bold did not receive the whole 2 MEZO (it should: it is the only market with weight)', post.mezo !== pre.mezo && 'wallet MEZO changed']; },
    note: () => 'the 2 MEZO now streams to Bold: 30% to cover holders, 70% to lenders, over 10 minutes' },
  { name: '7 Bold.claimRewards()', to: BOLD, ctx: true, data: () => calldata('claimRewards()'),
    check: (pre, post, r, tx, ctx) => { const got = post.mezo - pre.mezo, el = ctx.ts - stepCtx.distTs, frac = el >= 600n ? 600n : el, full = (FUND * 3000n / 10000n) * pre.jShares / pre.tJShares, want = full * frac / 600n; return [got <= 0n && 'nothing was claimed', !near(got, want, want / 50n + 10n ** 12n) && `claimed ${m(got, 6)} MEZO, expected about ${m(want, 6)} (${Number(frac)}/600 of ${m(full, 6)})`, post.pending > 10n ** 12n && 'claimable not cleared', transferAmt(r, MEZO, BOLD, F) !== got && 'no matching MEZO Transfer Bold -> wallet']; },
    note: (pre, post) => `claimed ${m(post.mezo - pre.mezo, 6)} MEZO (the full share would be ${m((FUND * 3000n / 10000n) * pre.jShares / pre.tJShares, 6)}; claiming before the 10-minute stream ends gives less)` },
];
const ACTIVE = STEPS.filter((s) => !(REHEARSAL_TOKEN !== null && s.lock));

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
  if (s.musd !== s0.musd) bad.push(`MUSD balance changed ${m(s0.musd, 6)} -> ${m(s.musd, 6)}`);
  if (s.jShares !== s0.jShares) bad.push('cover shares changed');
  return bad;
}
const stop = (code, msg) => { say(msg); process.exit(code); };

async function selftest() {
  GENESIS = big(call(G, 'genesis()(uint256)')); EPLEN = big(call(G, 'epochLength()(uint256)'));
  const s = await state();
  const vote = calldata('vote(uint256,address[],uint256[])', '401', `[${BOLD}]`, '[100]');
  say(`selftest: state read ok (${show(s)}); genesis ${GENESIS}, epoch length ${EPLEN}s; vote calldata builds (${vote.slice(0, 10)}…, ${(vote.length - 2) / 2} bytes); a wrong-amount fund is rejected: ${verifyTx(STEPS[4], { from: F, to: G, value: '0x0', input: calldata('fund(uint256)', '1') }, { status: '0x1', logs: [] }, s, null, null).length > 0}`);
  process.exit(0);
}

async function run() {
  if (BigInt(await rpc('eth_chainId')) !== 31611n) stop(2, 'DEVIATION: not chain 31611');
  GENESIS = big(call(G, 'genesis()(uint256)')); EPLEN = big(call(G, 'epochLength()(uint256)'));
  say(`watching ${F} on ${RPC} (read-only)${REHEARSAL_TOKEN !== null ? ` [rehearsal: voting with existing position #${REHEARSAL_TOKEN}, lock steps skipped]` : ''}`);
  let s0, waited = 0;
  for (;;) {
    s0 = await state();
    const why = [!near(s0.musd, 35n * E, E / 10n) && `MUSD ${m(s0.musd, 4)}`, s0.mezo !== 100n * E && `MEZO ${m(s0.mezo, 4)}`, s0.btc < 2n * LOCK && `BTC ${m(s0.btc, 6)}`, REHEARSAL_TOKEN === null && s0.nft !== 0n && 'the wallet already holds a veBTC position', !near(s0.cover, 15n * E, E / 100n) && `cover ${m(s0.cover, 4)}`, s0.allowBtc !== 0n && 'BTC allowance to veBTC present', s0.allowMezo !== 0n && 'MEZO allowance to the gauge present', s0.budget !== 0n && 'the current epoch is already funded', s0.collateral !== 0n && 'collateral present', s0.borrowShares !== 0n && 'debt present', s0.under && 'Bold under-covered', s0.price !== 10n ** 37n && 'oracle price differs'].filter(Boolean);
    if (!why.length) break;
    if (process.env.WATCH_WAIT_BASELINE && waited < 180) { waited += 3; await sleep(3000); continue; }
    stop(2, `DEVIATION: starting state differs from the approved plan (${why.join(', ')}). Nothing to verify; stopping.`);
  }
  const n0 = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest'])));
  let head = Number(BigInt(await rpc('eth_blockNumber')));
  say(`baseline OK at block ${head}, nonce ${n0}: ${show(s0)}`);
  say(`waiting for ${ACTIVE.length} wallet transactions, in this order:\n   ` + ACTIVE.map((x) => x.name).join('\n   '));
  let pre = s0, k = 0, scanned = head, announced = -1, lastInv = Date.now(), lastRe = 0, lastLine = ''; const seen = new Map();
  const deadline = Date.now() + (Number(process.env.WATCH_TIMEOUT_MIN) || 240) * 60_000;
  while (k < ACTIVE.length) {
    if (Date.now() > deadline) stop(3, `TIMEOUT with ${k}/${ACTIVE.length} steps verified.`);
    const latest = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'latest']))), pend = Number(BigInt(await rpc('eth_getTransactionCount', [F, 'pending'])));
    if (pend > latest && announced !== latest) { announced = latest; say(`transaction broadcast, waiting for confirmation (step ${latest - n0 + 1})`); }
    if (latest > n0 + ACTIVE.length) stop(2, 'DEVIATION: more wallet transactions than the plan allows. Stopping.');
    if (latest > n0 + k) {
      head = Number(BigInt(await rpc('eth_blockNumber')));
      for (let b = scanned + 1; b <= head; b++) { const bk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); for (const t of bk?.transactions || []) if (low(t.from) === low(F)) seen.set(Number(BigInt(t.nonce)), { t, ts: BigInt(bk.timestamp), n: BigInt(b) }); }
      scanned = head;
      while (seen.has(n0 + k) && k < ACTIVE.length) {
        const { t: tx, ts, n } = seen.get(n0 + k), step = ACTIVE[k];
        const r = await until('eth_getTransactionReceipt', [tx.hash]);
        const post = await state(Number(n));
        const bad = verifyTx(step, tx, r, pre, post, { ts, block: n });
        if (bad.length) stop(2, `DEVIATION at step ${step.name} (tx ${tx.hash}):\n - ${bad.join('\n - ')}\nSTOP: do not sign anything further until the founder and engineering have looked at this.`);
        say(`STEP ${step.name} VERIFIED  tx ${tx.hash}  block ${Number(n)}  gas ${Number(BigInt(r.gasUsed))}\n   before: ${show(pre)}\n   after:  ${show(post)}${step.note ? '\n   NOTE: ' + step.note(pre, post) : ''}`);
        const inv = invariants(s0, post); if (inv.length) stop(2, `DEVIATION after ${step.name}: ${inv.join('; ')}`);
        pre = post; k++;
        if (k < ACTIVE.length) say(`next: ${ACTIVE[k].name}`);
      }
    }
    // pre-signing rechecks for the two time-dependent steps
    if (k < ACTIVE.length && Date.now() - lastRe > 20_000 && (ACTIVE[k].name.startsWith('6') || ACTIVE[k].name.startsWith('7'))) {
      lastRe = Date.now(); AT = null;
      const nowTs = BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp); let line;
      if (ACTIVE[k].name.startsWith('6')) { const endTs = GENESIS + (stepCtx.fundEpoch + 1n) * EPLEN; let sim; try { call(G, 'distribute(uint256)', String(stepCtx.fundEpoch), '--from', F); sim = 'would succeed'; } catch (e) { sim = 'would FAIL: ' + String(e.stderr || e.message).split('\n')[0].slice(0, 80); } line = `RECHECK before step 6: epoch ${stepCtx.fundEpoch} ${nowTs >= endTs ? 'is over' : 'ends in ' + (endTs - nowTs) + 's'}; vault simulation ${sim} => ${nowTs >= endTs && sim === 'would succeed' ? 'OK to sign' : 'NOT yet'}`; }
      else { const el = nowTs - stepCtx.distTs, frac = el >= 600n ? 600n : el, st = await state(); line = `RECHECK before step 7: ${Number(frac) / 6}% of the 10-minute stream has run; claimable now ${m(st.pending, 6)} MEZO${frac >= 600n ? ' (the full share) => OK to sign' : ' (claiming now gives only this much; waiting until 100% gives the full share)'}`; }
      const key = line.replace(/\d+s|\d+(\.\d+)?%|claimable now [\d.]+/g, ''); if (key !== lastLine || ACTIVE[k].name.startsWith('7')) { lastLine = key; say(line); }
    }
    if (Date.now() - lastInv > 20_000) { lastInv = Date.now(); const s = await state(); const inv = invariants(s0, s); if (inv.length) stop(2, `DEVIATION: ${inv.join('; ')}`); }
    await sleep(3000);
  }
  const fin = await state();
  stop(0, `SESSION COMPLETE (${k}/${ACTIVE.length} steps).\n   start: ${show(s0)}\n   end:   ${show(fin)}\n   wallet BTC ${m(s0.btc, 6)} -> ${m(fin.btc, 6)} | MEZO ${m(s0.mezo, 6)} -> ${m(fin.mezo, 6)} | veBTC positions ${s0.ids.length} -> ${fin.ids.length}`);
}
(process.argv[2] === 'selftest' ? selftest : run)().catch((e) => { console.log('[watch3] ERROR (not a verdict):', e.message); process.exit(4); });
